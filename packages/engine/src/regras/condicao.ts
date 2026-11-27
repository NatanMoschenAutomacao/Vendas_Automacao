import { preenchido, type Contexto, type Valor, type ValorSimples } from "./contexto";

/**
 * Condições guardadas como árvore JSON e montadas na tela com blocos
 * E, OU e NÃO. Nunca são executadas como código.
 */
export const OPERADORES = [
  "igual",
  "diferente",
  "maior",
  "maior_igual",
  "menor",
  "menor_igual",
  "entre",
  "em",
  "contem",
  "preenchido",
] as const;
export type Operador = (typeof OPERADORES)[number];

export const ROTULO_OPERADOR: Record<Operador, string> = {
  igual: "é igual a",
  diferente: "é diferente de",
  maior: "é maior que",
  maior_igual: "é maior ou igual a",
  menor: "é menor que",
  menor_igual: "é menor ou igual a",
  entre: "está entre",
  em: "está em",
  contem: "contém",
  preenchido: "está preenchido",
};

export type Condicao =
  | { tipo: "e"; itens: Condicao[] }
  | { tipo: "ou"; itens: Condicao[] }
  | { tipo: "nao"; item: Condicao }
  | { tipo: "comparacao"; variavel: string; operador: Operador; valor?: ValorSimples | ValorSimples[] };

const MAX_PROFUNDIDADE = 12;
const MAX_NOS = 200;

function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function iguais(a: Valor, b: unknown): boolean {
  if (a === undefined || a === null || Array.isArray(a)) return false;
  if (typeof a === "number") return numero(b) === a;
  if (typeof a === "boolean") return b === a || String(b) === String(a);
  if (typeof b === "number") return numero(a) === b;
  return String(a) === String(b);
}

function comparar(atual: Valor, operador: Operador, valor: unknown): boolean {
  switch (operador) {
    case "preenchido":
      return preenchido(atual);
    case "igual":
      return iguais(atual, valor);
    case "diferente":
      return preenchido(atual) && !iguais(atual, valor);
    case "maior":
    case "maior_igual":
    case "menor":
    case "menor_igual": {
      const a = numero(atual);
      const b = numero(valor);
      if (a === null || b === null) return false;
      if (operador === "maior") return a > b;
      if (operador === "maior_igual") return a >= b;
      if (operador === "menor") return a < b;
      return a <= b;
    }
    case "entre": {
      const a = numero(atual);
      if (a === null || !Array.isArray(valor) || valor.length !== 2) return false;
      const lo = numero(valor[0]);
      const hi = numero(valor[1]);
      return lo !== null && hi !== null && a >= lo && a <= hi;
    }
    case "em":
      return Array.isArray(valor) && valor.some((v) => iguais(atual, v));
    case "contem":
      if (Array.isArray(atual)) {
        const procurados = Array.isArray(valor) ? valor : [valor];
        return procurados.every((p) => atual.includes(String(p)));
      }
      return typeof atual === "string" && typeof valor === "string" && atual.toLowerCase().includes(valor.toLowerCase());
  }
}

/** Avalia a condição. Variável ausente nunca satisfaz uma comparação. */
export function avaliarCondicao(c: Condicao | null | undefined, ctx: Contexto): boolean {
  if (!c) return true;
  switch (c.tipo) {
    case "e":
      return c.itens.every((i) => avaliarCondicao(i, ctx));
    case "ou":
      return c.itens.length === 0 || c.itens.some((i) => avaliarCondicao(i, ctx));
    case "nao":
      return !avaliarCondicao(c.item, ctx);
    case "comparacao":
      return comparar(ctx[c.variavel], c.operador, c.valor);
  }
}

/** Lista as variáveis usadas, sem repetição. */
export function variaveisDaCondicao(c: Condicao | null | undefined, saida = new Set<string>()): Set<string> {
  if (!c) return saida;
  if (c.tipo === "comparacao") saida.add(c.variavel);
  else if (c.tipo === "nao") variaveisDaCondicao(c.item, saida);
  else for (const i of c.itens) variaveisDaCondicao(i, saida);
  return saida;
}

export type TipoDeVariavel = "texto" | "numero" | "booleano" | "lista" | "multipla";

export interface DescricaoDeVariavel {
  nome: string;
  rotulo: string;
  tipo: TipoDeVariavel;
  unidade?: string | null;
  opcoes?: string[];
}

/**
 * Confere estrutura, limites, variáveis existentes e tipos. Devolve a lista
 * de problemas em português (vazia quando a condição é válida).
 */
export function validarCondicao(c: unknown, variaveis: readonly DescricaoDeVariavel[]): string[] {
  const erros: string[] = [];
  const porNome = new Map(variaveis.map((v) => [v.nome, v]));
  let nos = 0;

  const visitar = (n: unknown, prof: number) => {
    if (++nos > MAX_NOS) {
      if (nos === MAX_NOS + 1) erros.push(`A condição tem mais de ${MAX_NOS} blocos.`);
      return;
    }
    if (prof > MAX_PROFUNDIDADE) {
      erros.push(`A condição passa de ${MAX_PROFUNDIDADE} níveis.`);
      return;
    }
    if (!n || typeof n !== "object") {
      erros.push("Bloco de condição inválido.");
      return;
    }
    const no = n as Record<string, unknown>;
    if (no.tipo === "e" || no.tipo === "ou") {
      if (!Array.isArray(no.itens)) erros.push("Grupo sem itens.");
      else for (const i of no.itens) visitar(i, prof + 1);
      return;
    }
    if (no.tipo === "nao") {
      visitar(no.item, prof + 1);
      return;
    }
    if (no.tipo !== "comparacao") {
      erros.push("Bloco de condição inválido.");
      return;
    }
    const nome = String(no.variavel ?? "");
    const v = porNome.get(nome);
    if (!v) {
      erros.push(`A variável "${nome || "(vazia)"}" não existe aqui.`);
      return;
    }
    const op = no.operador as Operador;
    if (!OPERADORES.includes(op)) {
      erros.push(`Operador inválido em "${v.rotulo}".`);
      return;
    }
    if (op === "preenchido") return;
    const valor = no.valor;
    const numericos = ["maior", "maior_igual", "menor", "menor_igual", "entre"];
    if (numericos.includes(op) && v.tipo !== "numero") {
      erros.push(`"${v.rotulo}" não é numérico: não dá para usar "${ROTULO_OPERADOR[op]}".`);
      return;
    }
    if (op === "entre") {
      if (!Array.isArray(valor) || valor.length !== 2 || valor.some((x) => numero(x) === null))
        erros.push(`"${v.rotulo}": informe os dois limites numéricos.`);
      return;
    }
    if (op === "em" && (!Array.isArray(valor) || valor.length === 0)) {
      erros.push(`"${v.rotulo}": escolha ao menos um valor.`);
      return;
    }
    if (op === "contem" && v.tipo !== "multipla" && v.tipo !== "texto") {
      erros.push(`"${v.rotulo}" não é lista nem texto: não dá para usar "contém".`);
      return;
    }
    const lista = Array.isArray(valor) ? valor : [valor];
    if (lista.length === 0 || lista.some((x) => x === undefined || x === null || x === "")) {
      erros.push(`"${v.rotulo}": informe o valor da comparação.`);
      return;
    }
    for (const x of lista) {
      if (v.tipo === "numero" && numero(x) === null) erros.push(`"${v.rotulo}" é numérico: "${String(x)}" não é número.`);
      if ((v.tipo === "lista" || v.tipo === "multipla") && v.opcoes && !v.opcoes.includes(String(x)))
        erros.push(`"${v.rotulo}" não tem a opção "${String(x)}".`);
      if (v.tipo === "booleano" && typeof x !== "boolean" && x !== "true" && x !== "false")
        erros.push(`"${v.rotulo}" é sim ou não.`);
    }
  };
  visitar(c, 0);
  return [...new Set(erros)];
}

/** Texto legível da condição, para listas e pré-visualização. */
export function descreverCondicao(c: Condicao | null | undefined, rotulos: Record<string, string> = {}): string {
  if (!c) return "Sempre";
  const fmt = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).join(", ") : typeof v === "boolean" ? (v ? "Sim" : "Não") : String(v));
  switch (c.tipo) {
    case "comparacao": {
      const nome = rotulos[c.variavel] ?? c.variavel;
      if (c.operador === "preenchido") return `${nome} ${ROTULO_OPERADOR.preenchido}`;
      if (c.operador === "entre" && Array.isArray(c.valor)) return `${nome} está entre ${fmt(c.valor[0])} e ${fmt(c.valor[1])}`;
      return `${nome} ${ROTULO_OPERADOR[c.operador]} ${fmt(c.valor)}`;
    }
    case "nao":
      return `NÃO (${descreverCondicao(c.item, rotulos)})`;
    case "e":
    case "ou": {
      if (c.itens.length === 0) return "Sempre";
      const partes = c.itens.map((i) => (i.tipo === "e" || i.tipo === "ou" ? `(${descreverCondicao(i, rotulos)})` : descreverCondicao(i, rotulos)));
      return partes.join(c.tipo === "e" ? " E " : " OU ");
    }
  }
}
