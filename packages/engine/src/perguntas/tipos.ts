import type { Condicao } from "../regras/condicao";

/**
 * Pergunta é dado; tipo de pergunta é código. Um tipo novo exige só um
 * validador aqui e um componente de tela.
 */
export const TIPOS_DE_PERGUNTA = [
  "SELECAO_UNICA",
  "SELECAO_MULTIPLA",
  "SIM_NAO",
  "LISTA",
  "SELECAO_IMAGEM",
  "INTEIRO",
  "DECIMAL",
  "QUANTIDADE",
  "TEXTO_CURTO",
  "TEXTO_LONGO",
  "INFORMACAO",
  "CALCULADO",
] as const;
export type TipoDePergunta = (typeof TIPOS_DE_PERGUNTA)[number];

export const ROTULO_TIPO_PERGUNTA: Record<TipoDePergunta, string> = {
  SELECAO_UNICA: "Seleção única",
  SELECAO_MULTIPLA: "Seleção múltipla",
  SIM_NAO: "Sim ou não",
  LISTA: "Lista suspensa",
  SELECAO_IMAGEM: "Seleção por imagens",
  INTEIRO: "Número inteiro",
  DECIMAL: "Número decimal",
  QUANTIDADE: "Quantidade",
  TEXTO_CURTO: "Texto curto",
  TEXTO_LONGO: "Texto longo",
  INFORMACAO: "Informação automática (atributo do modelo)",
  CALCULADO: "Campo calculado (fórmula)",
};

export const TIPOS_COM_OPCOES: readonly TipoDePergunta[] = ["SELECAO_UNICA", "SELECAO_MULTIPLA", "LISTA", "SELECAO_IMAGEM"];
export const TIPOS_NUMERICOS: readonly TipoDePergunta[] = ["INTEIRO", "DECIMAL", "QUANTIDADE"];
/** Tipos que o vendedor não responde: o sistema preenche. */
export const TIPOS_AUTOMATICOS: readonly TipoDePergunta[] = ["INFORMACAO", "CALCULADO"];

export interface OpcaoDeResposta {
  valor: string;
  rotulo: string;
  imagemUrl?: string | null;
  condicao?: Condicao | null;
}

export type ValorDeResposta = string | number | boolean | string[];

export interface Pergunta {
  chave: string;
  texto: string;
  ajuda?: string | null;
  tipo: TipoDePergunta;
  unidade?: string | null;
  obrigatoria: boolean;
  minimo?: number | null;
  maximo?: number | null;
  passo?: number | null;
  padrao?: ValorDeResposta | null;
  ordem: number;
  condicao?: Condicao | null;
  opcoes: OpcaoDeResposta[];
  /** INFORMACAO: chave do atributo do modelo exibido. */
  atributo?: string | null;
  /** CALCULADO: fórmula sobre outras respostas e atributos. */
  formula?: string | null;
}

export type ModoDeHeranca = "NOVA" | "SUBSTITUIR" | "OCULTAR";

export interface PerguntaDeModelo extends Pergunta {
  modo: ModoDeHeranca;
}

export type Respostas = Readonly<Record<string, ValorDeResposta | null | undefined>>;
