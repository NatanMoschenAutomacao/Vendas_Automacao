/**
 * Estágio 4 do motor (parte da Fase 07): para cada controlador do projeto,
 * reúne os grupos e equipamentos ligados e verifica, nessa ordem:
 * funções (emparelhamento grupo ↔ saída funcional), recursos (contra o
 * integrado) e compatibilidade (modelos e tensão). Ter saídas suficientes
 * não basta (§24). Recursos são somados por controlador, nunca do projeto
 * inteiro (cenário 13); grupos consomem uma saída funcional cada (cenário 06).
 */
import type { ConfiguracaoDoProjeto, Id, Pendencia, SnapshotDaBiblioteca } from "../types";
import type { SinalDeIO } from "../materiais/tipos";
import type {
  AnaliseDeCompatibilidade,
  AnaliseDoControlador,
  ControladorNoSnapshot,
  DemandaDoControlador,
  RecursoDoControlador,
  ResultadoDosControladores,
  SaidaDistribuida,
} from "./tipos";

/**
 * Emparelhamento máximo (Kuhn) entre grupos e saídas. Determinístico:
 * grupos na ordem dada, saídas na ordem do cadastro.
 */
function emparelhar(grupos: { id: Id; funcaoId: Id }[], saidas: { id: Id; funcoes: Id[] }[], fixos: Map<Id, Id>): Map<Id, Id> {
  const saidaDe = new Map<Id, Id>(fixos); // grupo → saída
  const grupoDa = new Map<Id, Id>([...fixos].map(([g, s]) => [s, g])); // saída → grupo
  const fixas = new Set(fixos.values());
  const livres = grupos.filter((g) => !saidaDe.has(g.id));
  const tentar = (g: { id: Id; funcaoId: Id }, visitadas: Set<Id>): boolean => {
    for (const s of saidas) {
      if (fixas.has(s.id) || visitadas.has(s.id) || !s.funcoes.includes(g.funcaoId)) continue;
      visitadas.add(s.id);
      const atual = grupoDa.get(s.id);
      const grupoAtual = atual ? grupos.find((x) => x.id === atual) : undefined;
      if (!grupoAtual || tentar(grupoAtual, visitadas)) {
        saidaDe.set(g.id, s.id);
        grupoDa.set(s.id, g.id);
        return true;
      }
    }
    return false;
  };
  for (const g of livres) tentar(g, new Set());
  return saidaDe;
}

/** Avalia se um controlador da biblioteca atende uma demanda. Função pura, usada também para listar alternativas. */
export function avaliarControlador(
  c: ControladorNoSnapshot,
  demanda: DemandaDoControlador,
  snapshot: SnapshotDaBiblioteca,
  distribuicaoEscolhida: Record<Id, Id> = {},
): AnaliseDeCompatibilidade & { distribuicaoDescartada: Id[] } {
  const motivos: string[] = [];
  const funcoes = snapshot.funcoes ?? {};
  const comFuncao = demanda.grupos.filter((g): g is { id: Id; nome: string; funcaoId: Id } => !!g.funcaoId);

  // 1. Funções: escolha do vendedor validada, o resto distribuído sozinho.
  const fixos = new Map<Id, Id>();
  const descartada: Id[] = [];
  const usadas = new Set<Id>();
  for (const g of comFuncao) {
    const sId = distribuicaoEscolhida[g.id];
    if (!sId) continue;
    const s = c.saidas.find((x) => x.id === sId);
    if (!s || !s.funcoes.includes(g.funcaoId) || usadas.has(sId)) {
      descartada.push(g.id);
      continue;
    }
    usadas.add(sId);
    fixos.set(g.id, sId);
  }
  const mapa = emparelhar(comFuncao, c.saidas, fixos);
  const distribuicao: SaidaDistribuida[] = comFuncao.map((g) => {
    const sId = mapa.get(g.id) ?? null;
    return { grupoId: g.id, saidaId: sId, saidaCodigo: sId ? (c.saidas.find((s) => s.id === sId)?.codigo ?? null) : null, manual: fixos.has(g.id) };
  });
  for (const d of distribuicao) {
    if (d.saidaId) continue;
    const g = comFuncao.find((x) => x.id === d.grupoId)!;
    const f = funcoes[g.funcaoId];
    motivos.push(`Sem saída funcional livre para ${f?.nome ?? "a função"} (grupo ${g.nome}).`);
  }

  // 2. Recursos contra o integrado (expansão chega na Fase 08).
  const recursos: RecursoDoControlador[] = Object.entries(demanda.recursos)
    .filter(([, q]) => q > 0)
    .map(([tipoRecursoId, necessario]) => {
      const integrado = c.recursos[tipoRecursoId] ?? 0;
      return {
        tipoRecursoId,
        codigo: snapshot.tiposDeRecurso?.[tipoRecursoId]?.codigo ?? "?",
        necessario,
        integrado,
        deficit: Math.max(0, necessario - integrado),
      };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  for (const r of recursos) {
    if (r.deficit > 0 && c.tipo !== "clp") motivos.push(`Faltam ${r.deficit} ${r.codigo} (precisa ${r.necessario}, tem ${r.integrado}).`);
  }

  // 3. Compatibilidade: modelos e tensão.
  const semListaDeModelos = c.modelosCompativeis.length === 0;
  if (!semListaDeModelos) {
    const nomes = new Set<string>();
    for (const i of demanda.instancias) {
      if (!i.modeloId || c.modelosCompativeis.includes(i.modeloId)) continue;
      const eq = Object.values(snapshot.equipamentos ?? {}).find((e) => e.modelos.some((m) => m.id === i.modeloId));
      const m = eq?.modelos.find((x) => x.id === i.modeloId);
      nomes.add(m ? `${eq!.nome} ${m.nome}` : "um modelo");
    }
    for (const n of nomes) motivos.push(`Não é compatível com ${n}.`);
  }
  if (demanda.tensao != null && c.tensoes.length > 0 && !c.tensoes.includes(demanda.tensao))
    motivos.push(`Não aceita alimentação de ${demanda.tensao} V (aceita ${c.tensoes.join(", ")} V).`);

  return { controladorId: c.id, compativel: motivos.length === 0, motivos, distribuicao, recursos, semListaDeModelos, distribuicaoDescartada: descartada };
}

export function calcularControladores(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
  sinais: readonly SinalDeIO[],
): { controladores: ResultadoDosControladores; pendencias: Pendencia[] } {
  const pendencias: Pendencia[] = [];
  const cps = config.controladores ?? [];
  const ids = new Set(cps.map((c) => c.id));
  const grupos = config.grupos ?? [];
  const biblioteca = Object.values(snapshot.controladores ?? {}).filter((c) => c.ativo);

  // Controlador responsável por cada instância: ligação direta > primeiro grupo com controlador.
  const controladorDaInstancia = new Map<Id, Id>();
  for (const inst of config.instancias) {
    if (inst.controladorId && ids.has(inst.controladorId)) controladorDaInstancia.set(inst.id, inst.controladorId);
  }
  for (const g of grupos) {
    if (g.controladorId && !ids.has(g.controladorId)) {
      pendencias.push({ codigo: "REFERENCIA_INVALIDA", gravidade: "advertencia", mensagem: `O grupo ${g.nome} aponta para um controlador removido.`, referencia: g.id });
      continue;
    }
    if (!g.controladorId) continue;
    for (const m of g.membros) if (m.quantidade > 0 && !controladorDaInstancia.has(m.instanciaId)) controladorDaInstancia.set(m.instanciaId, g.controladorId);
  }
  for (const inst of config.instancias) {
    if (inst.controladorId && !ids.has(inst.controladorId))
      pendencias.push({ codigo: "REFERENCIA_INVALIDA", gravidade: "advertencia", mensagem: "Um item aponta para um controlador removido.", referencia: inst.id });
  }

  // Sinais por controlador: pela instância de origem; sinais de painel vão ao único controlador do painel.
  const recursosPor = new Map<Id, Record<Id, number>>();
  const semControlador = new Map<Id, { tipoRecursoId: Id; codigo: string; quantidade: number }>();
  for (const s of sinais) {
    let alvo = s.origem.instanciaId ? controladorDaInstancia.get(s.origem.instanciaId) : undefined;
    if (!alvo && !s.origem.instanciaId && s.painelId) {
      const doPainel = cps.filter((c) => c.painelId === s.painelId);
      if (doPainel.length === 1) alvo = doPainel[0]!.id;
    }
    if (!alvo) {
      const x = semControlador.get(s.tipoRecursoId) ?? { tipoRecursoId: s.tipoRecursoId, codigo: s.codigo, quantidade: 0 };
      x.quantidade += s.quantidade;
      semControlador.set(s.tipoRecursoId, x);
      continue;
    }
    const r = recursosPor.get(alvo) ?? {};
    r[s.tipoRecursoId] = (r[s.tipoRecursoId] ?? 0) + s.quantidade;
    recursosPor.set(alvo, r);
  }

  const porControlador: AnaliseDoControlador[] = cps.map((cp) => {
    const seus = grupos.filter((g) => g.controladorId === cp.id);
    const instancias = config.instancias.filter((i) => controladorDaInstancia.get(i.id) === cp.id);
    const painel = config.paineis?.find((p) => p.id === cp.painelId);
    const demanda: DemandaDoControlador = {
      grupos: seus.map((g) => ({ id: g.id, nome: g.nome, funcaoId: g.funcaoId })),
      instancias: instancias.map((i) => ({ id: i.id, modeloId: i.modeloId, painelId: i.painelId ?? null })),
      recursos: recursosPor.get(cp.id) ?? {},
      tensao: painel?.tensao ?? null,
    };
    const alternativas = [...biblioteca]
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((c) => {
        const a = avaliarControlador(c, demanda, snapshot);
        return { controladorId: c.id, compativel: a.compativel, motivos: a.motivos };
      })
      .sort((a, b) => Number(b.compativel) - Number(a.compativel));
    const base = { id: cp.id, grupos: seus.map((g) => g.id), instancias: instancias.map((i) => i.id), alternativas };

    if (!cp.painelId)
      pendencias.push({ codigo: "CONTROLADOR_SEM_PAINEL", gravidade: "advertencia", mensagem: `Indique o painel do controlador ${cp.nome}.`, referencia: cp.id });
    else if (!painel)
      pendencias.push({ codigo: "REFERENCIA_INVALIDA", gravidade: "advertencia", mensagem: `O controlador ${cp.nome} aponta para um painel removido.`, referencia: cp.id });
    for (const i of instancias) {
      if (cp.painelId && i.painelId && i.painelId !== cp.painelId)
        pendencias.push({
          codigo: "CONTROLADOR_EM_OUTRO_PAINEL",
          gravidade: "advertencia",
          mensagem: `Um item ligado ao controlador ${cp.nome} está em outro painel.`,
          referencia: i.id,
        });
    }

    if (!cp.controladorId) {
      pendencias.push({ codigo: "CONTROLADOR_NAO_ESCOLHIDO", gravidade: "impeditiva", mensagem: `Escolha o modelo do controlador ${cp.nome}.`, referencia: cp.id });
      return base;
    }
    const c = snapshot.controladores?.[cp.controladorId];
    if (!c?.ativo) {
      pendencias.push({
        codigo: "CONTROLADOR_INDISPONIVEL",
        gravidade: "impeditiva",
        mensagem: `O controlador escolhido em ${cp.nome} foi removido ou inativado.`,
        referencia: cp.id,
      });
      return base;
    }
    const a = avaliarControlador(c, demanda, snapshot, cp.distribuicao ?? {});
    if (a.distribuicaoDescartada.length)
      pendencias.push({
        codigo: "DISTRIBUICAO_DESCARTADA",
        gravidade: "advertencia",
        mensagem: `A distribuição escolhida para ${a.distribuicaoDescartada.length} grupo(s) em ${cp.nome} deixou de ser válida e foi refeita automaticamente.`,
        referencia: cp.id,
      });
    for (const m of a.motivos)
      pendencias.push({ codigo: "CONTROLADOR_INCOMPATIVEL", gravidade: "impeditiva", mensagem: `${cp.nome} (${c.nome}): ${m}`, referencia: cp.id });
    for (const r of a.recursos) {
      if (r.deficit > 0 && c.tipo === "clp")
        pendencias.push({
          codigo: "RECURSO_REQUER_EXPANSAO",
          gravidade: "advertencia",
          mensagem: `${cp.nome}: faltam ${r.deficit} ${r.codigo} no integrado. A expansão por cartões é dimensionada na Fase 08.`,
          referencia: cp.id,
        });
    }
    if (a.semListaDeModelos && instancias.length > 0)
      pendencias.push({
        codigo: "COMPATIBILIDADE_NAO_CADASTRADA",
        gravidade: "informativa",
        mensagem: `${c.nome} não tem lista de modelos compatíveis cadastrada. Confira a compatibilidade com a equipe técnica.`,
        referencia: cp.id,
      });
    return {
      ...base,
      controladorId: a.controladorId,
      compativel: a.compativel,
      motivos: a.motivos,
      distribuicao: a.distribuicao,
      recursos: a.recursos,
      semListaDeModelos: a.semListaDeModelos,
    };
  });

  // Só cobra o controlador quando a biblioteca já tem controladores cadastrados.
  const gruposSemControlador = (biblioteca.length === 0 ? [] : grupos).filter((g) => g.funcaoId && !(g.controladorId && ids.has(g.controladorId))).map((g) => g.id);
  for (const id of gruposSemControlador) {
    const g = grupos.find((x) => x.id === id)!;
    pendencias.push({ codigo: "GRUPO_SEM_CONTROLADOR", gravidade: "advertencia", mensagem: `Escolha o controlador do grupo ${g.nome}.`, referencia: g.id });
  }
  const sinaisSemControlador = [...semControlador.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (cps.length > 0 && sinaisSemControlador.length > 0)
    pendencias.push({
      codigo: "SINAIS_SEM_CONTROLADOR",
      gravidade: "advertencia",
      mensagem: `Há sinais de I/O sem controlador: ${sinaisSemControlador.map((s) => `${s.quantidade} ${s.codigo}`).join(", ")}. Ligue os itens a um controlador.`,
    });

  return { controladores: { porControlador, gruposSemControlador, sinaisSemControlador }, pendencias };
}
