import type { Contexto } from "./contexto";

/**
 * Fórmulas de quantidade: texto curto interpretado por um parser próprio,
 * nunca executado como código. Aceita números, variáveis com prefixo,
 * + - * /, parênteses, comparações (= <> < <= > >=), e/ou/nao e as funções
 * min, max, arred, arredCima, arredBaixo e se(cond, a, b).
 * Ex.: arredCima(base.quantidade / 4) * 2
 */
export type NoDeFormula =
  | { t: "num"; v: number }
  | { t: "txt"; v: string }
  | { t: "var"; nome: string }
  | { t: "un"; op: "-" | "nao"; a: NoDeFormula }
  | { t: "bin"; op: string; a: NoDeFormula; b: NoDeFormula }
  | { t: "fn"; nome: string; args: NoDeFormula[] };

export class ErroDeFormula extends Error {}

export const FUNCOES = ["min", "max", "arred", "arredCima", "arredBaixo", "se", "abs"] as const;
const LIMITE_TEXTO = 500;
const LIMITE_PROFUNDIDADE = 24;

type Token = { k: "num" | "id" | "txt" | "op" | "("  | ")" | ","; v: string; pos: number };

function tokenizar(texto: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < texto.length) {
    const c = texto[i]!;
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < texto.length && /[0-9.]/.test(texto[j]!)) j++;
      const s = texto.slice(i, j);
      if (!/^\d+(\.\d+)?$/.test(s)) throw new ErroDeFormula(`Número inválido "${s}" na posição ${i + 1}.`);
      out.push({ k: "num", v: s, pos: i });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i;
      while (j < texto.length && /[A-Za-z0-9_.]/.test(texto[j]!)) j++;
      out.push({ k: "id", v: texto.slice(i, j), pos: i });
      i = j;
      continue;
    }
    if (c === '"') {
      const j = texto.indexOf('"', i + 1);
      if (j < 0) throw new ErroDeFormula(`Texto sem aspas de fechamento na posição ${i + 1}.`);
      out.push({ k: "txt", v: texto.slice(i + 1, j), pos: i });
      i = j + 1;
      continue;
    }
    const dois = texto.slice(i, i + 2);
    if (["<=", ">=", "<>"].includes(dois)) {
      out.push({ k: "op", v: dois, pos: i });
      i += 2;
      continue;
    }
    if ("+-*/<>=".includes(c)) {
      out.push({ k: "op", v: c, pos: i });
      i++;
      continue;
    }
    if (c === "(" || c === ")" || c === ",") {
      out.push({ k: c, v: c, pos: i });
      i++;
      continue;
    }
    throw new ErroDeFormula(`Caractere inesperado "${c}" na posição ${i + 1}.`);
  }
  return out;
}

const PRECEDENCIA: Record<string, number> = {
  ou: 1,
  e: 2,
  "=": 3,
  "<>": 3,
  "<": 3,
  "<=": 3,
  ">": 3,
  ">=": 3,
  "+": 4,
  "-": 4,
  "*": 5,
  "/": 5,
};

export function analisarFormula(texto: string): NoDeFormula {
  if (texto.length > LIMITE_TEXTO) throw new ErroDeFormula(`A fórmula passa de ${LIMITE_TEXTO} caracteres.`);
  const tokens = tokenizar(texto);
  if (tokens.length === 0) throw new ErroDeFormula("Fórmula vazia.");
  let p = 0;
  const olhar = () => tokens[p];
  const consumir = () => tokens[p++]!;

  const operador = (t: Token | undefined) =>
    t && (t.k === "op" || (t.k === "id" && (t.v === "e" || t.v === "ou"))) ? t.v : null;

  const primario = (prof: number): NoDeFormula => {
    if (prof > LIMITE_PROFUNDIDADE) throw new ErroDeFormula("A fórmula tem parênteses ou funções demais aninhados.");
    const t = consumir();
    if (!t) throw new ErroDeFormula("A fórmula termina antes do esperado.");
    if (t.k === "num") return { t: "num", v: Number(t.v) };
    if (t.k === "txt") return { t: "txt", v: t.v };
    if (t.k === "op" && t.v === "-") return { t: "un", op: "-", a: primario(prof + 1) };
    if (t.k === "(") {
      const e = expressao(0, prof + 1);
      if (consumir()?.k !== ")") throw new ErroDeFormula("Falta fechar um parêntese.");
      return e;
    }
    if (t.k === "id") {
      if (t.v === "nao") return { t: "un", op: "nao", a: primario(prof + 1) };
      if (t.v === "verdadeiro" || t.v === "falso") return { t: "num", v: t.v === "verdadeiro" ? 1 : 0 };
      if (olhar()?.k === "(") {
        consumir();
        const args: NoDeFormula[] = [];
        if (olhar()?.k !== ")") {
          for (;;) {
            args.push(expressao(0, prof + 1));
            if (olhar()?.k === ",") {
              consumir();
              continue;
            }
            break;
          }
        }
        if (consumir()?.k !== ")") throw new ErroDeFormula(`Falta fechar o parêntese de ${t.v}(...).`);
        // projeto.tem("x") e similares viram variável do contexto.
        if (t.v.includes(".")) {
          if (args.length !== 1 || args[0]!.t !== "txt") throw new ErroDeFormula(`${t.v}(...) recebe um texto entre aspas.`);
          return { t: "var", nome: `${t.v}(${args[0]!.v})` };
        }
        if (!(FUNCOES as readonly string[]).includes(t.v)) throw new ErroDeFormula(`Função desconhecida: ${t.v}.`);
        const aridade: Record<string, [number, number]> = {
          min: [1, 20],
          max: [1, 20],
          arred: [1, 2],
          arredCima: [1, 1],
          arredBaixo: [1, 1],
          abs: [1, 1],
          se: [3, 3],
        };
        const [lo, hi] = aridade[t.v]!;
        if (args.length < lo || args.length > hi) throw new ErroDeFormula(`${t.v}(...) recebe ${lo === hi ? lo : `de ${lo} a ${hi}`} argumento(s).`);
        return { t: "fn", nome: t.v, args };
      }
      if (!t.v.includes(".")) throw new ErroDeFormula(`Variável sem prefixo: "${t.v}". Use resposta.${t.v}, modelo.${t.v}...`);
      return { t: "var", nome: t.v };
    }
    throw new ErroDeFormula(`"${t.v}" inesperado na posição ${t.pos + 1}.`);
  };

  const expressao = (minimo: number, prof: number): NoDeFormula => {
    let esq = primario(prof);
    for (;;) {
      const op = operador(olhar());
      if (!op) break;
      const prec = PRECEDENCIA[op];
      if (prec === undefined || prec < minimo) break;
      consumir();
      const dir = expressao(prec + 1, prof + 1);
      esq = { t: "bin", op, a: esq, b: dir };
    }
    return esq;
  };

  const raiz = expressao(0, 0);
  if (p < tokens.length) throw new ErroDeFormula(`"${tokens[p]!.v}" sobrando na posição ${tokens[p]!.pos + 1}.`);
  return raiz;
}

export function variaveisDaFormula(no: NoDeFormula, saida = new Set<string>()): Set<string> {
  if (no.t === "var") saida.add(no.nome);
  else if (no.t === "un") variaveisDaFormula(no.a, saida);
  else if (no.t === "bin") {
    variaveisDaFormula(no.a, saida);
    variaveisDaFormula(no.b, saida);
  } else if (no.t === "fn") for (const a of no.args) variaveisDaFormula(a, saida);
  return saida;
}

function comoNumero(v: unknown, nome: string): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  throw new ErroDeFormula(`"${nome}" não tem valor numérico.`);
}

/** Arredonda com precisão de 10 casas para evitar resíduos de ponto flutuante. */
function limpar(n: number) {
  return Math.round(n * 1e10) / 1e10;
}

export function avaliarFormula(no: NoDeFormula, ctx: Contexto): number {
  const rec = (n: NoDeFormula): number | string => {
    switch (n.t) {
      case "num":
        return n.v;
      case "txt":
        return n.v;
      case "var": {
        const v = ctx[n.nome];
        if (v === undefined || v === null || v === "") throw new ErroDeFormula(`"${n.nome}" não está preenchido.`);
        if (typeof v === "string") return Number.isFinite(Number(v)) && v.trim() !== "" ? Number(v) : v;
        if (Array.isArray(v)) return v.length;
        return comoNumero(v, n.nome);
      }
      case "un": {
        const a = rec(n.a);
        return n.op === "-" ? -comoNumero(a, "-") : comoNumero(a, "nao") ? 0 : 1;
      }
      case "bin": {
        if (n.op === "e") return comoNumero(rec(n.a), "e") && comoNumero(rec(n.b), "e") ? 1 : 0;
        if (n.op === "ou") return comoNumero(rec(n.a), "ou") || comoNumero(rec(n.b), "ou") ? 1 : 0;
        const a = rec(n.a);
        const b = rec(n.b);
        if (n.op === "=") return a === b || (typeof a !== typeof b && String(a) === String(b)) ? 1 : 0;
        if (n.op === "<>") return a === b || (typeof a !== typeof b && String(a) === String(b)) ? 0 : 1;
        const x = comoNumero(a, String(a));
        const y = comoNumero(b, String(b));
        switch (n.op) {
          case "+":
            return limpar(x + y);
          case "-":
            return limpar(x - y);
          case "*":
            return limpar(x * y);
          case "/":
            if (y === 0) throw new ErroDeFormula("Divisão por zero.");
            return limpar(x / y);
          case "<":
            return x < y ? 1 : 0;
          case "<=":
            return x <= y ? 1 : 0;
          case ">":
            return x > y ? 1 : 0;
          case ">=":
            return x >= y ? 1 : 0;
        }
        throw new ErroDeFormula(`Operador desconhecido: ${n.op}.`);
      }
      case "fn": {
        if (n.nome === "se") return comoNumero(rec(n.args[0]!), "se") ? rec(n.args[1]!) : rec(n.args[2]!);
        const xs = n.args.map((a) => comoNumero(rec(a), n.nome));
        switch (n.nome) {
          case "min":
            return Math.min(...xs);
          case "max":
            return Math.max(...xs);
          case "abs":
            return Math.abs(xs[0]!);
          case "arredCima":
            return Math.ceil(limpar(xs[0]!));
          case "arredBaixo":
            return Math.floor(limpar(xs[0]!));
          case "arred": {
            const casas = xs[1] ?? 0;
            const f = 10 ** casas;
            return Math.round(limpar(xs[0]! * f)) / f;
          }
        }
        throw new ErroDeFormula(`Função desconhecida: ${n.nome}.`);
      }
    }
  };
  return comoNumero(rec(no), "resultado");
}

/** Atalho: analisa e avalia. Lança ErroDeFormula com mensagem em português. */
export function calcularFormula(texto: string, ctx: Contexto): number {
  return avaliarFormula(analisarFormula(texto), ctx);
}
