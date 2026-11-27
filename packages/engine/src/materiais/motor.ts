/**
 * Estágios 3 (recursos), 5 (materiais) e 6 (ajustes manuais) do motor.
 *
 * Toda linha sai de uma regra avaliada sobre uma base (ou do fornecimento
 * do próprio equipamento) e carrega sua origem. A lista consolidada é só
 * o agrupamento dessas linhas por item + unidade (cenários 07 e 08).
 * Uma instância compartilhada é avaliada uma vez (cenário 09); instância
 * existente não gera a linha de fornecimento (cenário 17).
 */
import { avaliarCondicao } from "../regras/condicao";
import type { Valor } from "../regras/contexto";
import { calcularFormula, ErroDeFormula } from "../regras/formula";
import type { ResultadoDaEstrutura } from "../estrutura/estrutura";
import type { ConfiguracaoDoProjeto, Id, Pendencia, SnapshotDaBiblioteca } from "../types";
import type {
  Arredondamento,
  BaseDeCalculo,
  EfeitoDaRegra,
  LinhaConsolidada,
  LinhaDeMaterial,
  OrigemDaLinha,
  RegraNoSnapshot,
  ResultadoDeMateriais,
  ResumoDeIO,
  SinalDeIO,
} from "./tipos";

type Ctx = Record<string, Valor>;

/** Uma avaliação de regra: contexto, escopo das linhas que ela pode alterar e origem. */
interface Avaliacao {
  regra: RegraNoSnapshot;
  chaveDoContexto: string;
  ctx: Ctx;
  origem: OrigemDaLinha;
  /** Linhas que substituir/quantidade/remover podem alcançar. */
  alcanca: (l: LinhaDeMaterial) => boolean;
}

const arred4 = (n: number) => Math.round(n * 10_000) / 10_000;

export function arredondar(valor: number, modo: Arredondamento, fracionavel: boolean): number {
  let v = valor;
  if (modo === "cima") v = Math.ceil(arred4(v));
  else if (modo === "baixo") v = Math.floor(arred4(v));
  else if (modo === "proximo") v = Math.round(v);
  if (!fracionavel) v = Math.ceil(arred4(v));
  return arred4(v);
}

function ordenarRegras(a: RegraNoSnapshot, b: RegraNoSnapshot) {
  return a.prioridade - b.prioridade || a.codigo.localeCompare(b.codigo);
}

export function calcularMateriais(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
  estrutura: ResultadoDaEstrutura,
  contextos: ReadonlyMap<Id, Ctx>,
  ctxProjeto: Ctx,
): { materiais: ResultadoDeMateriais; pendencias: Pendencia[] } {
  const pendencias: Pendencia[] = [];
  const itens = snapshot.itens ?? {};
  const regras = (snapshot.regras ?? []).filter((r) => r.ativo).sort(ordenarRegras);
  const paineis = config.paineis ?? [];
  const quantidade = (q: number) => (Number.isInteger(q) && q > 0 ? q : 0);

  /* ───────────── Avaliações (regra × contexto) ───────────── */
  const avaliacoes: Avaliacao[] = [];
  const derivadas = (lista: ResultadoDaEstrutura["acionamentos"], id: Id) => lista.find((l) => l.instanciaId === id)?.quantidade ?? 0;

  const ctxDoPainel = (painelId: Id): Ctx => {
    const p = paineis.find((x) => x.id === painelId);
    const ctx: Ctx = { ...ctxProjeto, "painel.equipamentos": config.instancias.filter((i) => i.painelId === painelId).reduce((s, i) => s + quantidade(i.quantidade), 0) };
    if (p?.tipoId && snapshot.tiposDePainel?.[p.tipoId]) ctx["painel.tipo"] = snapshot.tiposDePainel[p.tipoId]!.nome;
    if (p?.tensao != null) ctx["painel.tensao"] = p.tensao;
    return ctx;
  };

  for (const regra of regras) {
    const dono = regra.dono;
    if (dono.tipo === "equipamento" || dono.tipo === "modelo") {
      for (const inst of config.instancias) {
        if (dono.tipo === "equipamento" ? inst.equipamentoId !== dono.id : inst.modeloId !== dono.id) continue;
        const eq = snapshot.equipamentos?.[inst.equipamentoId];
        if (!eq?.ativo) continue;
        const q = quantidade(inst.quantidade);
        const baseQ: Record<string, number> = {
          por_equipamento: q,
          por_acionamento: derivadas(estrutura.acionamentos, inst.id),
          por_protecao: derivadas(estrutura.protecoes, inst.id),
          uma_vez_por_item: q > 0 ? 1 : 0,
        };
        const bq = baseQ[regra.base] ?? 0;
        if (bq <= 0) continue;
        avaliacoes.push({
          regra,
          chaveDoContexto: `i:${inst.id}`,
          ctx: { ...(contextos.get(inst.id) ?? ctxProjeto), "base.quantidade": bq },
          origem: { tipo: "regra", regraId: regra.id, regraCodigo: regra.codigo, instanciaId: inst.id, painelId: inst.painelId ?? undefined, base: regra.base, baseQuantidade: bq },
          alcanca: (l) => l.origem.instanciaId === inst.id,
        });
      }
    } else if (dono.tipo === "tipoDePainel" || regra.base === "por_painel") {
      for (const p of paineis) {
        if (dono.tipo === "tipoDePainel" && p.tipoId !== dono.id) continue;
        avaliacoes.push({
          regra,
          chaveDoContexto: `p:${p.id}`,
          ctx: { ...ctxDoPainel(p.id), "base.quantidade": 1 },
          origem: { tipo: "regra", regraId: regra.id, regraCodigo: regra.codigo, painelId: p.id, base: regra.base, baseQuantidade: 1 },
          alcanca: (l) => l.origem.painelId === p.id,
        });
      }
    } else if (regra.base === "por_projeto") {
      avaliacoes.push({
        regra,
        chaveDoContexto: "projeto",
        ctx: { ...ctxProjeto, "base.quantidade": 1 },
        origem: { tipo: "regra", regraId: regra.id, regraCodigo: regra.codigo, base: regra.base, baseQuantidade: 1 },
        alcanca: () => true,
      });
    } else if (regra.base === "por_grupo") {
      for (const g of config.grupos ?? []) {
        const bq = estrutura.grupos.find((x) => x.grupoId === g.id)?.unidades ?? 0;
        if (bq <= 0) continue;
        const funcao = g.funcaoId ? snapshot.funcoes?.[g.funcaoId]?.codigo : undefined;
        avaliacoes.push({
          regra,
          chaveDoContexto: `g:${g.id}`,
          ctx: { ...ctxProjeto, "base.quantidade": bq, ...(funcao ? { "projeto.funcao_do_grupo": funcao } : {}) },
          origem: { tipo: "regra", regraId: regra.id, regraCodigo: regra.codigo, grupoId: g.id, base: regra.base, baseQuantidade: bq },
          alcanca: (l) => l.origem.grupoId === g.id,
        });
      }
    } else if (regra.base === "por_setor") {
      for (const s of config.setores ?? []) {
        const bq = config.instancias.filter((i) => i.setorId === s.id).reduce((t, i) => t + quantidade(i.quantidade), 0);
        if (bq <= 0) continue;
        avaliacoes.push({
          regra,
          chaveDoContexto: `s:${s.id}`,
          ctx: { ...ctxProjeto, "base.quantidade": bq },
          origem: { tipo: "regra", regraId: regra.id, regraCodigo: regra.codigo, setorId: s.id, base: regra.base, baseQuantidade: bq },
          alcanca: (l) => l.origem.setorId === s.id,
        });
      }
    } else if (regra.base === "por_ambiente") {
      for (const a of config.ambientes ?? []) {
        const bq = estrutura.porAmbiente.find((x) => x.ambienteId === a.id)?.quantidade ?? 0;
        if (bq <= 0) continue;
        avaliacoes.push({
          regra,
          chaveDoContexto: `a:${a.id}`,
          ctx: { ...ctxProjeto, "base.quantidade": bq },
          origem: { tipo: "regra", regraId: regra.id, regraCodigo: regra.codigo, ambienteId: a.id, base: regra.base, baseQuantidade: bq },
          alcanca: (l) => l.origem.ambienteId === a.id,
        });
      }
    }
  }

  const disparadas = avaliacoes.filter((a) => avaliarCondicao(a.regra.condicao, a.ctx));

  /** Avalia uma fórmula; erro ou valor negativo viram pendência e devolvem null. */
  const avaliar = (a: Avaliacao, formula: string): number | null => {
    try {
      const v = calcularFormula(formula, a.ctx);
      if (!Number.isFinite(v)) throw new ErroDeFormula("Resultado inválido.");
      if (v < 0) {
        pendencias.push({
          codigo: "QUANTIDADE_NEGATIVA",
          gravidade: "impeditiva",
          mensagem: `A regra ${a.regra.codigo} resultou em quantidade negativa (${arred4(v)}).`,
          referencia: a.origem.instanciaId ?? a.regra.id,
        });
        return null;
      }
      return v;
    } catch (e) {
      pendencias.push({
        codigo: "FORMULA_ERRO",
        gravidade: "impeditiva",
        mensagem: `Regra ${a.regra.codigo}: ${e instanceof Error ? e.message : "erro na fórmula"}.`,
        referencia: a.origem.instanciaId ?? a.regra.id,
      });
      return null;
    }
  };

  const itemValido = (a: Avaliacao | null, itemId: Id) => {
    const item = itens[itemId];
    if (item?.ativo) return item;
    pendencias.push({
      codigo: "ITEM_INDISPONIVEL",
      gravidade: "impeditiva",
      mensagem: a ? `A regra ${a.regra.codigo} usa um item removido ou inativo do catálogo.` : "Um item do catálogo foi removido ou inativado.",
      referencia: a?.origem.instanciaId ?? a?.regra.id,
    });
    return null;
  };

  /* ───────────── Estágio 3: recursos de automação ───────────── */
  const sinais: SinalDeIO[] = [];
  for (const a of disparadas) {
    if (a.regra.estagio !== "recurso") continue;
    for (const [n, ef] of a.regra.efeitos.entries()) {
      if (ef.acao !== "recurso") continue;
      const tipo = snapshot.tiposDeRecurso?.[ef.tipoRecursoId];
      if (!tipo?.ativo) {
        pendencias.push({
          codigo: "RECURSO_INDISPONIVEL",
          gravidade: "impeditiva",
          mensagem: `A regra ${a.regra.codigo} usa um tipo de recurso removido ou inativo.`,
          referencia: a.origem.instanciaId ?? a.regra.id,
        });
        continue;
      }
      const v = avaliar(a, ef.formula);
      if (v === null) continue;
      const q = Math.ceil(arred4(v));
      if (q <= 0) continue;
      sinais.push({
        chave: `${a.regra.codigo}#${n}:${a.chaveDoContexto}:${tipo.codigo}`,
        tipoRecursoId: tipo.id,
        codigo: tipo.codigo,
        fisico: tipo.fisico,
        funcao: ef.funcao,
        quantidade: q,
        painelId: a.origem.painelId ?? null,
        origem: a.origem,
      });
    }
  }

  /* ───────────── Estágio 5: materiais ───────────── */
  const linhas: LinhaDeMaterial[] = [];
  const porChave = new Map<string, LinhaDeMaterial>();
  const regraPorId = new Map(regras.map((r) => [r.id, r]));

  // Fornecimento do próprio equipamento (só o que a Zanatta fornece).
  for (const inst of config.instancias) {
    if (inst.fornecimento !== "fornecido") continue;
    const eq = snapshot.equipamentos?.[inst.equipamentoId];
    const modelo = eq?.modelos.find((m) => m.id === inst.modeloId);
    if (!modelo?.itemId || quantidade(inst.quantidade) === 0) continue;
    const item = itemValido(null, modelo.itemId);
    if (!item) continue;
    const linha: LinhaDeMaterial = {
      chave: `fornecimento:i:${inst.id}:${item.codigo}`,
      itemId: item.id,
      codigo: item.codigo,
      descricao: item.descricao,
      unidade: item.unidade,
      quantidade: quantidade(inst.quantidade),
      origem: { tipo: "fornecimento", instanciaId: inst.id, painelId: inst.painelId ?? undefined, base: "por_equipamento", baseQuantidade: quantidade(inst.quantidade) },
    };
    linhas.push(linha);
    porChave.set(linha.chave, linha);
  }

  type Operacao = { a: Avaliacao; ef: EfeitoDaRegra; n: number };
  const ops = (acao: EfeitoDaRegra["acao"]): Operacao[] =>
    disparadas
      .filter((a) => a.regra.estagio === "material")
      .flatMap((a) => a.regra.efeitos.map((ef, n) => ({ a, ef, n })))
      .filter((o) => o.ef.acao === acao);

  // 1. Adicionar.
  for (const { a, ef } of ops("adicionar")) {
    if (ef.acao !== "adicionar") continue;
    const item = itemValido(a, ef.itemId);
    if (!item) continue;
    const v = avaliar(a, ef.formula);
    if (v === null) continue;
    const q = arredondar(v, ef.arredondamento, item.fracionavel);
    if (q <= 0) continue;
    const chave = `${a.regra.codigo}:${a.chaveDoContexto}:${item.codigo}`;
    const existente = porChave.get(chave);
    if (existente) existente.quantidade = arred4(existente.quantidade + q);
    else {
      const linha: LinhaDeMaterial = { chave, itemId: item.id, codigo: item.codigo, descricao: item.descricao, unidade: item.unidade, quantidade: q, origem: a.origem };
      linhas.push(linha);
      porChave.set(chave, linha);
    }
  }

  /** Uma remoção/substituição com a mesma prioridade da regra que adicionou é conflito (§20). */
  const emConflito = (o: Operacao, l: LinhaDeMaterial) => {
    const origem = l.origem.regraId ? regraPorId.get(l.origem.regraId) : undefined;
    if (origem && origem.id !== o.a.regra.id && origem.prioridade === o.a.regra.prioridade) {
      pendencias.push({
        codigo: "REGRA_CONFLITO",
        gravidade: "impeditiva",
        mensagem: `As regras ${origem.codigo} e ${o.a.regra.codigo} têm a mesma prioridade e ações opostas sobre ${l.codigo}.`,
        referencia: l.origem.instanciaId ?? o.a.regra.id,
      });
      return true;
    }
    return false;
  };

  // 2. Substituir.
  for (const o of ops("substituir")) {
    const { a, ef } = o;
    if (ef.acao !== "substituir") continue;
    const novo = itemValido(a, ef.substitutoId);
    if (!novo) continue;
    for (const l of linhas) {
      if (l.itemId !== ef.itemId || !a.alcanca(l) || emConflito(o, l)) continue;
      Object.assign(l, { itemId: novo.id, codigo: novo.codigo, descricao: novo.descricao, unidade: novo.unidade, quantidade: arredondar(l.quantidade, "nenhum", novo.fracionavel) });
    }
  }

  // 3. Alterar quantidade.
  for (const o of ops("quantidade")) {
    const { a, ef } = o;
    if (ef.acao !== "quantidade") continue;
    const alvo = linhas.filter((l) => l.itemId === ef.itemId && a.alcanca(l));
    if (alvo.length === 0) continue;
    const v = avaliar(a, ef.formula);
    if (v === null) continue;
    for (const l of alvo) l.quantidade = arredondar(v, ef.arredondamento, itens[l.itemId]?.fracionavel ?? false);
  }

  // 4. Remover (só o que a regra de origem permite).
  const removidas = new Set<string>();
  for (const o of ops("remover")) {
    const { a, ef } = o;
    if (ef.acao !== "remover") continue;
    for (const l of linhas) {
      if (l.itemId !== ef.itemId || !a.alcanca(l) || removidas.has(l.chave) || emConflito(o, l)) continue;
      const origem = l.origem.regraId ? regraPorId.get(l.origem.regraId) : undefined;
      if (origem && origem.id !== a.regra.id && !origem.permiteRemocao) {
        pendencias.push({
          codigo: "REMOCAO_NAO_PERMITIDA",
          gravidade: "advertencia",
          mensagem: `A regra ${a.regra.codigo} tentou remover ${l.codigo}, que a regra ${origem.codigo} não permite remover.`,
          referencia: l.origem.instanciaId ?? a.regra.id,
        });
        continue;
      }
      if (l.origem.tipo === "fornecimento") {
        pendencias.push({
          codigo: "REMOCAO_NAO_PERMITIDA",
          gravidade: "advertencia",
          mensagem: `A regra ${a.regra.codigo} não pode remover o fornecimento do próprio equipamento (${l.codigo}).`,
          referencia: l.origem.instanciaId ?? a.regra.id,
        });
        continue;
      }
      removidas.add(l.chave);
    }
  }
  let finais = linhas.filter((l) => !removidas.has(l.chave) && l.quantidade > 0);

  /* ───────────── Estágio 6: ajustes manuais ───────────── */
  for (const aj of config.ajustes ?? []) {
    if (!aj.justificativa?.trim()) {
      pendencias.push({ codigo: "AJUSTE_SEM_JUSTIFICATIVA", gravidade: "impeditiva", mensagem: "Todo ajuste manual precisa de justificativa.", referencia: aj.id });
      continue;
    }
    if (aj.acao === "adicionar") {
      const item = aj.itemId ? itemValido(null, aj.itemId) : null;
      const q = Number(aj.quantidade);
      if (!item || !(q > 0)) {
        if (item) pendencias.push({ codigo: "AJUSTE_INVALIDO", gravidade: "impeditiva", mensagem: "Informe uma quantidade maior que zero no item avulso.", referencia: aj.id });
        continue;
      }
      finais.push({
        chave: `ajuste:${aj.id}`,
        itemId: item.id,
        codigo: item.codigo,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade: arredondar(q, "nenhum", item.fracionavel),
        origem: { tipo: "ajuste" },
        ajustadaPor: aj.id,
      });
      continue;
    }
    const linha = finais.find((l) => l.chave === aj.chave);
    if (!linha) {
      pendencias.push({
        codigo: "AJUSTE_CONFLITO",
        gravidade: "advertencia",
        mensagem: "Um ajuste manual aponta para uma linha que deixou de existir após mudanças no projeto. Revise ou exclua o ajuste.",
        referencia: aj.id,
      });
      continue;
    }
    if (aj.acao === "remover") finais = finais.filter((l) => l !== linha);
    else {
      const q = Number(aj.quantidade);
      if (!(q >= 0)) {
        pendencias.push({ codigo: "AJUSTE_INVALIDO", gravidade: "impeditiva", mensagem: "A quantidade ajustada não pode ser negativa.", referencia: aj.id });
        continue;
      }
      linha.quantidade = arredondar(q, "nenhum", itens[linha.itemId]?.fracionavel ?? false);
      linha.ajustadaPor = aj.id;
      if (linha.quantidade === 0) finais = finais.filter((l) => l !== linha);
    }
  }

  /* ───────────── Totalização: item + unidade, nunca a descrição ───────────── */
  const consolidado = new Map<string, LinhaConsolidada>();
  for (const l of finais) {
    const k = `${l.itemId}|${l.unidade}`;
    const c = consolidado.get(k) ?? { itemId: l.itemId, codigo: l.codigo, descricao: l.descricao, unidade: l.unidade, quantidade: 0, chaves: [] };
    c.quantidade = arred4(c.quantidade + l.quantidade);
    c.chaves.push(l.chave);
    consolidado.set(k, c);
  }

  const io = new Map<string, ResumoDeIO>();
  for (const s of sinais) {
    const k = `${s.painelId ?? "-"}|${s.tipoRecursoId}`;
    const r = io.get(k) ?? { painelId: s.painelId, tipoRecursoId: s.tipoRecursoId, codigo: s.codigo, fisico: s.fisico, quantidade: 0 };
    r.quantidade += s.quantidade;
    io.set(k, r);
  }

  return {
    materiais: {
      linhas: finais,
      consolidado: [...consolidado.values()].sort((a, b) => a.codigo.localeCompare(b.codigo)),
      sinais,
      io: [...io.values()],
    },
    pendencias,
  };
}

export type { BaseDeCalculo };
