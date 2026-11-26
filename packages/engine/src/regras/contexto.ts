/**
 * Variáveis disponíveis para condições e fórmulas, sempre com prefixo:
 * resposta.*, modelo.*, instancia.*, projeto.*, base.* (e, nas próximas
 * fases, ambiente.*, setor.*, painel.*, controlador.*).
 *
 * O contexto é um mapa plano "prefixo.chave" → valor. Funções de projeto
 * como projeto.tem("x") são guardadas como "projeto.tem(x)".
 */
export type ValorSimples = string | number | boolean;
export type Valor = ValorSimples | string[] | null | undefined;
export type Contexto = Readonly<Record<string, Valor>>;

export const PREFIXOS = ["resposta", "modelo", "instancia", "projeto", "base", "ambiente", "setor", "painel", "controlador"] as const;

const VARIAVEL = /^(resposta|modelo|instancia|projeto|base|ambiente|setor|painel|controlador)\.[a-z][a-z0-9_]*(\([^()]*\))?$/;

export function variavelValida(nome: string): boolean {
  return VARIAVEL.test(nome);
}

export function preenchido(v: Valor): boolean {
  if (v === undefined || v === null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  return true;
}
