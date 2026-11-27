/**
 * Estágio 7 do motor: preços (Fase 09).
 *
 * - Cálculo em decimal exato (decimal.js), nunca em ponto flutuante.
 * - O preço unitário de venda é arredondado para centavos e o total de cada
 *   linha (unitário × quantidade) também. Os subtotais são a soma das linhas
 *   arredondadas, por isso tela, PDF e Excel batem (cenário 18).
 * - Venda fixa usa o preço de venda cadastrado, sem regra comercial por cima.
 *   Custo + regra aplica markup ou margem ao custo. Nunca os dois (§33).
 * - Item sem preço: linha "sem preço", total parcial e pendência impeditiva
 *   (cenário 15).
 * - Descontos e acréscimos depois da soma, por grupo ou no total geral.
 * - Impostos da v1: linhas percentuais por grupo sobre o líquido do grupo.
 */
import Decimal from "decimal.js";
import type { ConfiguracaoDoProjeto, Pendencia, SnapshotDaBiblioteca } from "../types";
import type { ResultadoDeMateriais } from "../materiais/tipos";
import {
  GRUPOS_COMERCIAIS,
  type AjusteComercial,
  type GrupoComercial,
  type LinhaDePreco,
  type PrecoNoSnapshot,
  type RegraComercial,
  type ResultadoDePrecos,
  type TotalDoGrupo,
  type ValorDeAjuste,
} from "./tipos";

const Dec = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
type D = Decimal;

const ZERO = new Dec(0);
const CEM = new Dec(100);

/** Arredonda para centavos (meio para cima). */
export function centavos(v: D): D {
  return v.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Lê um decimal em texto. Devolve null para vazio ou inválido. */
export function lerDecimal(v: string | number | null | undefined): D | null {
  if (v === null || v === undefined || v === "") return null;
  try {
    const d = new Dec(typeof v === "number" ? v.toString() : v.trim().replace(",", "."));
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

const texto2 = (v: D) => centavos(v).toFixed(2);

/** A regra comercial é utilizável? Markup ≥ 0; margem entre 0 e 100 (exclusive). */
export function regraComercialValida(regra: RegraComercial | null | undefined): regra is RegraComercial {
  if (!regra) return false;
  const p = lerDecimal(regra.percentual);
  if (!p || p.isNegative()) return false;
  return regra.tipo === "markup" || p.lessThan(CEM);
}

/** Markup equivalente a uma margem e vice-versa, em percentual com 2 casas (para o cadastro mostrar os dois). */
export function equivalencia(regra: RegraComercial): string | null {
  if (!regraComercialValida(regra)) return null;
  const p = lerDecimal(regra.percentual)!.div(CEM);
  if (regra.tipo === "margem") return p.div(new Dec(1).minus(p)).times(CEM).toDecimalPlaces(2).toFixed(2);
  return p.div(new Dec(1).plus(p)).times(CEM).toDecimalPlaces(2).toFixed(2);
}

/**
 * Preço unitário de venda, já em centavos. Null quando falta dado.
 * Markup: venda = custo × (1 + markup). Margem: venda = custo ÷ (1 − margem).
 */
export function precoUnitarioDeVenda(preco: PrecoNoSnapshot | null | undefined, regra: RegraComercial | null | undefined): D | null {
  if (!preco) return null;
  if (preco.modo === "venda_fixa") {
    const v = lerDecimal(preco.venda);
    return v && !v.isNegative() ? centavos(v) : null;
  }
  const custo = lerDecimal(preco.custo);
  if (!custo || custo.isNegative() || !regraComercialValida(regra)) return null;
  const p = lerDecimal(regra.percentual)!.div(CEM);
  return centavos(regra.tipo === "markup" ? custo.times(p.plus(1)) : custo.div(new Dec(1).minus(p)));
}

/** Percentual de a sobre b com 2 casas; 0 quando b é zero. */
const percentualDe = (a: D, b: D) => (b.isZero() ? "0.00" : a.div(b).times(CEM).toDecimalPlaces(2).toFixed(2));

export function calcularPrecos(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
  materiais: ResultadoDeMateriais,
): { precos: ResultadoDePrecos; pendencias: Pendencia[] } {
  const pendencias: Pendencia[] = [];
  const ocultos = snapshot.custosOcultos === true;
  const regra = snapshot.regraComercial ?? null;
  const linhas: LinhaDePreco[] = [];
  let faltaRegra = false;

  // Materiais: uma linha por item + unidade (a lista consolidada).
  for (const c of materiais.consolidado) {
    const item = snapshot.itens?.[c.itemId];
    const preco = snapshot.precos?.[c.itemId] ?? null;
    const unitario = precoUnitarioDeVenda(preco, regra);
    if (preco?.modo === "custo_regra" && lerDecimal(preco.custo) && !regraComercialValida(regra)) faltaRegra = true;
    const custoUnit = ocultos ? null : lerDecimal(preco?.custo ?? null);
    const qtd = new Dec(c.quantidade.toString());
    linhas.push({
      chave: `m:${c.itemId}|${c.unidade}`,
      tipo: "material",
      grupo: item?.grupo ?? "material",
      itemId: c.itemId,
      codigo: c.codigo,
      descricao: c.descricao,
      unidade: c.unidade,
      quantidade: c.quantidade,
      modo: unitario ? preco!.modo : null,
      unitario: unitario ? unitario.toFixed(2) : null,
      total: unitario ? texto2(unitario.times(qtd)) : null,
      semPreco: !unitario,
      ...(ocultos ? {} : { custoUnitario: custoUnit ? custoUnit.toFixed(2) : null, custoTotal: custoUnit ? texto2(custoUnit.times(qtd)) : null }),
      chaves: c.chaves,
    });
  }

  // Serviços: consolidados por serviço + unidade.
  const porServico = new Map<string, LinhaDePreco>();
  for (const s of materiais.servicos) {
    const k = `s:${s.servicoId}|${s.unidade}`;
    const l = porServico.get(k);
    if (l) {
      l.quantidade = Math.round((l.quantidade + s.quantidade) * 10_000) / 10_000;
      l.chaves.push(s.chave);
      continue;
    }
    porServico.set(k, {
      chave: k,
      tipo: "servico",
      grupo: "servico",
      servicoId: s.servicoId,
      codigo: s.codigo,
      descricao: s.descricao,
      unidade: s.unidade,
      quantidade: s.quantidade,
      modo: null,
      unitario: null,
      total: null,
      semPreco: true,
      chaves: [s.chave],
    });
  }
  for (const l of [...porServico.values()].sort((a, b) => a.codigo.localeCompare(b.codigo))) {
    const servico = snapshot.servicos?.[l.servicoId!];
    const valor = lerDecimal(servico?.valor ?? null);
    const unitario = valor && !valor.isNegative() ? centavos(valor) : null;
    const qtd = new Dec(l.quantidade.toString());
    const custoUnit = ocultos ? null : lerDecimal(servico?.custo ?? null);
    Object.assign(l, {
      modo: unitario ? "venda_fixa" : null,
      unitario: unitario ? unitario.toFixed(2) : null,
      total: unitario ? texto2(unitario.times(qtd)) : null,
      semPreco: !unitario,
      ...(ocultos ? {} : { custoUnitario: custoUnit ? custoUnit.toFixed(2) : null, custoTotal: custoUnit ? texto2(custoUnit.times(qtd)) : null }),
    });
    linhas.push(l);
  }

  for (const l of linhas) {
    if (!l.semPreco) continue;
    pendencias.push({
      codigo: "SEM_PRECO",
      gravidade: "impeditiva",
      mensagem: `${l.codigo} (${l.descricao}) está sem preço vigente. O total aparece como parcial.`,
      referencia: l.itemId ?? l.servicoId,
    });
  }
  if (faltaRegra) {
    pendencias.push({
      codigo: "REGRA_COMERCIAL_AUSENTE",
      gravidade: "impeditiva",
      mensagem: "Há itens em \"custo + regra\", mas a regra comercial (markup ou margem) não está configurada.",
    });
  }

  /* ───────────── Ajustes comerciais válidos ───────────── */
  const ajustes = config.comercial?.ajustes ?? [];
  const validos: (AjusteComercial & { numero: D })[] = [];
  for (const a of ajustes) {
    const v = lerDecimal(a.valor);
    let erro: string | null = null;
    if (!v || !v.greaterThan(0)) erro = "Informe um valor maior que zero.";
    else if (a.modo === "percentual" && v.greaterThan(CEM)) erro = "O percentual não pode passar de 100%.";
    else if (!a.justificativa?.trim()) erro = "Todo desconto ou acréscimo precisa de justificativa.";
    if (erro) {
      pendencias.push({ codigo: "AJUSTE_COMERCIAL_INVALIDO", gravidade: "impeditiva", mensagem: erro, referencia: a.id });
      continue;
    }
    validos.push({ ...a, numero: v! });
  }

  /** Aplica os ajustes de um escopo sobre uma base. Descontos não deixam o valor negativo. */
  const aplicar = (escopo: AjusteComercial["escopo"], base: D): { valores: ValorDeAjuste[]; liquido: D; descontos: D } => {
    const valores: ValorDeAjuste[] = [];
    let liquido = base;
    let descontos = ZERO;
    for (const a of validos.filter((x) => x.escopo === escopo)) {
      let valor = centavos(a.modo === "percentual" ? base.times(a.numero).div(CEM) : a.numero);
      if (a.tipo === "desconto") {
        if (valor.greaterThan(liquido)) {
          pendencias.push({
            codigo: "DESCONTO_MAIOR_QUE_O_VALOR",
            gravidade: "impeditiva",
            mensagem: "O desconto é maior que o valor sobre o qual ele incide.",
            referencia: a.id,
          });
          valor = liquido;
        }
        descontos = descontos.plus(valor);
        valor = valor.negated();
      }
      liquido = liquido.plus(valor);
      valores.push({
        id: a.id,
        tipo: a.tipo,
        modo: a.modo,
        percentual: a.modo === "percentual" ? a.numero.toFixed() : null,
        valor: valor.toFixed(2),
        justificativa: a.justificativa,
        autor: a.autor ?? null,
      });
    }
    return { valores, liquido, descontos };
  };

  /* ───────────── Totais por grupo ───────────── */
  const grupos: TotalDoGrupo[] = [];
  let somaGrupos = ZERO;
  let somaLiquidos = ZERO;
  let custoTotal: D | null = ocultos ? null : ZERO;
  for (const g of GRUPOS_COMERCIAIS as readonly GrupoComercial[]) {
    const doGrupo = linhas.filter((l) => l.grupo === g);
    const temAjuste = validos.some((a) => a.escopo === g);
    if (doGrupo.length === 0 && !temAjuste) continue;
    const subtotal = doGrupo.reduce((s, l) => (l.total ? s.plus(l.total) : s), ZERO);
    const { valores, liquido, descontos } = aplicar(g, subtotal);
    const impostos = (snapshot.impostos ?? [])
      .filter((i) => i.grupo === g)
      .flatMap((i) => {
        const p = lerDecimal(i.percentual);
        if (!p || p.isNegative()) return [];
        return [{ id: i.id, nome: i.nome, percentual: p.toFixed(), valor: texto2(liquido.times(p).div(CEM)) }];
      });
    const total = impostos.reduce((s, i) => s.plus(i.valor), liquido);
    let custo: D | null = null;
    if (!ocultos) {
      custo = doGrupo.reduce<D | null>((s, l) => (s && l.custoTotal ? s.plus(l.custoTotal) : null), ZERO);
      custoTotal = custoTotal && custo ? custoTotal.plus(custo) : null;
    }
    somaGrupos = somaGrupos.plus(total);
    somaLiquidos = somaLiquidos.plus(liquido);
    grupos.push({
      grupo: g,
      subtotal: subtotal.toFixed(2),
      ajustes: valores,
      liquido: liquido.toFixed(2),
      impostos,
      total: total.toFixed(2),
      percentualDeDesconto: percentualDe(descontos, subtotal),
      parcial: doGrupo.some((l) => l.semPreco),
      ...(ocultos ? {} : { custo: custo ? custo.toFixed(2) : null }),
    });
  }

  const geral = aplicar("total", somaGrupos);
  const parcial = linhas.some((l) => l.semPreco);

  let margem: string | null = null;
  if (!ocultos && custoTotal && !parcial) {
    const venda = somaLiquidos.plus(geral.liquido.minus(somaGrupos));
    margem = venda.isZero() ? null : percentualDe(venda.minus(custoTotal), venda);
  }

  return {
    precos: {
      linhas,
      grupos,
      subtotal: somaGrupos.toFixed(2),
      ajustesGerais: geral.valores,
      total: geral.liquido.toFixed(2),
      percentualDeDescontoGeral: percentualDe(geral.descontos, somaGrupos),
      parcial,
      custosOcultos: ocultos,
      ...(ocultos ? {} : { custoTotal: custoTotal ? custoTotal.toFixed(2) : null, margem }),
    },
    pendencias,
  };
}
