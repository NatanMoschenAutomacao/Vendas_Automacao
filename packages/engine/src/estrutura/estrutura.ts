/**
 * Estágio 2 do motor: estrutura do projeto (Fase 05).
 *
 * Mantém separadas as contagens do §18: equipamentos físicos (soma das
 * quantidades), acionamentos e proteções (derivados de cada modelo),
 * grupos de controle e setores (entidades próprias). Nenhuma é deduzida
 * da outra. Uma instância que atende vários ambientes aparece em cada um
 * deles, mas é contada uma única vez (cenário 09).
 */
import type {
  ConfiguracaoDoProjeto,
  Derivacao,
  Id,
  InstanciaDeEquipamento,
  Pendencia,
  SnapshotDaBiblioteca,
} from "../types";

export interface LinhaDerivada {
  instanciaId: Id;
  tipo: "individual" | "coletivo";
  quantidade: number;
}

export interface InstanciaNoAmbiente {
  instanciaId: Id;
  quantidade: number;
  compartilhada: boolean;
}

export interface ResultadoDaEstrutura {
  totais: {
    /** Equipamentos físicos: soma das quantidades, cada instância uma vez. */
    equipamentos: number;
    fornecidos: number;
    existentes: number;
    acionamentos: number;
    protecoes: number;
    grupos: number;
    ambientes: number;
    setores: number;
    paineis: number;
    /** Instâncias que atendem mais de um ambiente. */
    compartilhadas: number;
  };
  porEquipamento: { equipamentoId: Id; quantidade: number }[];
  /** Na ordem dos ambientes; `ambienteId: null` reúne o que não tem ambiente. */
  porAmbiente: { ambienteId: Id | null; quantidade: number; instancias: InstanciaNoAmbiente[] }[];
  acionamentos: LinhaDerivada[];
  protecoes: LinhaDerivada[];
  grupos: { grupoId: Id; unidades: number }[];
  /** Unidades de cada instância ainda fora de qualquer grupo de controle. */
  foraDeGrupo: { instanciaId: Id; quantidade: number }[];
}

const quantidadeValida = (q: number) => (Number.isInteger(q) && q > 0 ? q : 0);

/** Regra efetiva: a do modelo, se houver; senão a do equipamento. */
export function derivacaoEfetiva(
  doEquipamento: Derivacao | null | undefined,
  doModelo: Derivacao | null | undefined,
): Derivacao {
  return doModelo ?? doEquipamento ?? { tipo: "nenhum" };
}

/** Quantidade derivada de uma instância (acionamentos ou proteções). */
export function quantidadeDerivada(d: Derivacao, unidades: number): number {
  if (unidades <= 0 || d.tipo === "nenhum") return 0;
  if (d.tipo === "individual") return unidades;
  const porGrupo = d.porGrupo && d.porGrupo > 0 ? Math.floor(d.porGrupo) : unidades;
  return Math.ceil(unidades / porGrupo);
}

export function calcularEstrutura(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
): { estrutura: ResultadoDaEstrutura; pendencias: Pendencia[] } {
  const pendencias: Pendencia[] = [];
  const ambientes = config.ambientes ?? [];
  const setores = config.setores ?? [];
  const paineis = config.paineis ?? [];
  const grupos = config.grupos ?? [];
  const idsAmbiente = new Set(ambientes.map((a) => a.id));
  const setorPorId = new Map(setores.map((s) => [s.id, s]));
  const painelPorId = new Map(paineis.map((p) => [p.id, p]));
  const instPorId = new Map(config.instancias.map((i) => [i.id, i]));

  const totais = {
    equipamentos: 0,
    fornecidos: 0,
    existentes: 0,
    acionamentos: 0,
    protecoes: 0,
    grupos: grupos.length,
    ambientes: ambientes.length,
    setores: setores.length,
    paineis: paineis.length,
    compartilhadas: 0,
  };
  const porEquipamento = new Map<Id, number>();
  const acionamentos: LinhaDerivada[] = [];
  const protecoes: LinhaDerivada[] = [];
  const porAmbiente = new Map<Id | null, InstanciaNoAmbiente[]>([...ambientes.map((a) => [a.id, []] as [Id, InstanciaNoAmbiente[]]), [null, []]]);

  for (const inst of config.instancias) {
    const q = quantidadeValida(inst.quantidade);
    totais.equipamentos += q;
    if (inst.fornecimento === "existente") totais.existentes += q;
    else totais.fornecidos += q;
    porEquipamento.set(inst.equipamentoId, (porEquipamento.get(inst.equipamentoId) ?? 0) + q);

    // Ambientes: válidos, sem repetição. Compartilhada aparece em cada um.
    const seus = [...new Set(inst.ambientes ?? [])];
    const invalidos = seus.filter((a) => !idsAmbiente.has(a));
    if (invalidos.length) {
      pendencias.push({
        codigo: "REFERENCIA_INVALIDA",
        gravidade: "impeditiva",
        mensagem: "O item aponta para um ambiente que não existe mais.",
        referencia: inst.id,
      });
    }
    const validos = seus.filter((a) => idsAmbiente.has(a));
    const compartilhada = validos.length > 1;
    if (compartilhada) totais.compartilhadas++;
    if (validos.length === 0) {
      porAmbiente.get(null)!.push({ instanciaId: inst.id, quantidade: q, compartilhada: false });
      if (ambientes.length > 0) {
        pendencias.push({
          codigo: "ITEM_SEM_AMBIENTE",
          gravidade: "advertencia",
          mensagem: "Indique o ambiente atendido pelo item.",
          referencia: inst.id,
        });
      }
    }
    for (const a of validos) porAmbiente.get(a)!.push({ instanciaId: inst.id, quantidade: q, compartilhada });

    if (inst.setorId) {
      const setor = setorPorId.get(inst.setorId);
      if (!setor) {
        pendencias.push({
          codigo: "REFERENCIA_INVALIDA",
          gravidade: "impeditiva",
          mensagem: "O item aponta para um setor que não existe mais.",
          referencia: inst.id,
        });
      } else if (!validos.includes(setor.ambienteId)) {
        pendencias.push({
          codigo: "SETOR_FORA_DO_AMBIENTE",
          gravidade: "impeditiva",
          mensagem: `O setor "${setor.nome}" não pertence a um ambiente atendido pelo item.`,
          referencia: inst.id,
        });
      }
    }

    if (inst.painelId && !painelPorId.has(inst.painelId)) {
      pendencias.push({
        codigo: "REFERENCIA_INVALIDA",
        gravidade: "impeditiva",
        mensagem: "O item aponta para um painel que não existe mais.",
        referencia: inst.id,
      });
    } else if (!inst.painelId && paineis.length > 0) {
      pendencias.push({
        codigo: "ITEM_SEM_PAINEL",
        gravidade: "advertencia",
        mensagem: "Indique o painel que atende o item.",
        referencia: inst.id,
      });
    }

    // Acionamentos e proteções derivados do modelo (ou do equipamento).
    const eq = snapshot.equipamentos?.[inst.equipamentoId];
    const modelo = eq?.modelos.find((m) => m.id === inst.modeloId);
    if (eq) {
      for (const [lista, d] of [
        [acionamentos, derivacaoEfetiva(eq.acionamento, modelo?.acionamento)],
        [protecoes, derivacaoEfetiva(eq.protecao, modelo?.protecao)],
      ] as const) {
        const n = quantidadeDerivada(d, q);
        if (n > 0 && d.tipo !== "nenhum") lista.push({ instanciaId: inst.id, tipo: d.tipo, quantidade: n });
      }
    }
  }
  totais.acionamentos = acionamentos.reduce((s, l) => s + l.quantidade, 0);
  totais.protecoes = protecoes.reduce((s, l) => s + l.quantidade, 0);

  for (const s of setores) {
    if (!idsAmbiente.has(s.ambienteId)) {
      pendencias.push({
        codigo: "REFERENCIA_INVALIDA",
        gravidade: "impeditiva",
        mensagem: `O setor "${s.nome}" aponta para um ambiente que não existe mais.`,
        referencia: s.id,
      });
    }
  }
  for (const p of paineis) {
    if (!p.tipoId || !snapshot.tiposDePainel?.[p.tipoId]?.ativo) {
      pendencias.push({
        codigo: "PAINEL_SEM_TIPO",
        gravidade: "advertencia",
        mensagem: `Escolha o tipo do painel "${p.identificacao}".`,
        referencia: p.id,
      });
    }
  }

  // Grupos de controle: a soma das unidades em grupos não passa da quantidade da instância.
  const emGrupos = new Map<Id, number>();
  const resultadoGrupos: ResultadoDaEstrutura["grupos"] = [];
  for (const g of grupos) {
    let unidades = 0;
    for (const m of g.membros) {
      const inst = instPorId.get(m.instanciaId);
      if (!inst) {
        pendencias.push({
          codigo: "REFERENCIA_INVALIDA",
          gravidade: "impeditiva",
          mensagem: `O grupo "${g.nome}" aponta para um item que não existe mais.`,
          referencia: g.id,
        });
        continue;
      }
      const q = quantidadeValida(m.quantidade);
      unidades += q;
      emGrupos.set(inst.id, (emGrupos.get(inst.id) ?? 0) + q);
    }
    resultadoGrupos.push({ grupoId: g.id, unidades });
    if (unidades === 0) {
      pendencias.push({
        codigo: "GRUPO_VAZIO",
        gravidade: "advertencia",
        mensagem: `O grupo "${g.nome}" não tem equipamentos.`,
        referencia: g.id,
      });
    }
    if (!g.funcaoId || !snapshot.funcoes?.[g.funcaoId]?.ativo) {
      pendencias.push({
        codigo: "GRUPO_SEM_FUNCAO",
        gravidade: "advertencia",
        mensagem: `Escolha a função de controle do grupo "${g.nome}".`,
        referencia: g.id,
      });
    }
  }
  const foraDeGrupo: ResultadoDaEstrutura["foraDeGrupo"] = [];
  for (const inst of config.instancias) {
    const q = quantidadeValida(inst.quantidade);
    const usadas = emGrupos.get(inst.id) ?? 0;
    if (usadas > q) {
      pendencias.push({
        codigo: "GRUPO_EXCEDE_QUANTIDADE",
        gravidade: "impeditiva",
        mensagem: `Os grupos usam ${usadas} unidade(s), mas o item tem ${q}.`,
        referencia: inst.id,
      });
    } else if (grupos.length > 0 && usadas < q) {
      foraDeGrupo.push({ instanciaId: inst.id, quantidade: q - usadas });
    }
  }

  return {
    estrutura: {
      totais,
      porEquipamento: [...porEquipamento].map(([equipamentoId, quantidade]) => ({ equipamentoId, quantidade })),
      porAmbiente: [...porAmbiente]
        .filter(([id, l]) => id !== null || l.length > 0)
        .map(([ambienteId, instancias]) => ({
          ambienteId,
          instancias,
          quantidade: instancias.reduce((s, i) => s + i.quantidade, 0),
        })),
      acionamentos,
      protecoes,
      grupos: resultadoGrupos,
      foraDeGrupo,
    },
    pendencias,
  };
}

/** Variáveis de estrutura para as perguntas da instância. */
export function contextoDeEstrutura(
  inst: InstanciaDeEquipamento,
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
): Record<string, string | number | boolean> {
  const ctx: Record<string, string | number | boolean> = {
    "instancia.compartilhada": (inst.ambientes?.length ?? 0) > 1,
    "projeto.ambientes": config.ambientes?.length ?? 0,
  };
  const painel = config.paineis?.find((p) => p.id === inst.painelId);
  if (painel) {
    const tipo = painel.tipoId ? snapshot.tiposDePainel?.[painel.tipoId]?.nome : undefined;
    if (tipo) ctx["painel.tipo"] = tipo;
    if (painel.tensao != null) ctx["painel.tensao"] = painel.tensao;
  }
  return ctx;
}
