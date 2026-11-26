import type { Condicao, ModoDeHeranca, OpcaoDeResposta, Pergunta, PerguntaDeModelo, TipoDePergunta, ValorDeResposta } from "@zanatta/engine";

/** Linha do banco (campos usados) → pergunta do motor. */
export interface LinhaDePergunta {
  chave: string;
  modo: ModoDeHeranca;
  texto: string;
  ajuda: string | null;
  tipo: string;
  unidade: string | null;
  obrigatoria: boolean;
  minimo: number | null;
  maximo: number | null;
  passo: number | null;
  padrao: unknown;
  condicao: unknown;
  opcoes: unknown;
  atributo: string | null;
  formula: string | null;
  ordem: number;
}

export function paraPergunta(l: LinhaDePergunta): Pergunta {
  return {
    chave: l.chave,
    texto: l.texto,
    ajuda: l.ajuda,
    tipo: l.tipo as TipoDePergunta,
    unidade: l.unidade,
    obrigatoria: l.obrigatoria,
    minimo: l.minimo,
    maximo: l.maximo,
    passo: l.passo,
    padrao: (l.padrao ?? null) as ValorDeResposta | null,
    ordem: l.ordem,
    condicao: (l.condicao ?? null) as Condicao | null,
    opcoes: (Array.isArray(l.opcoes) ? l.opcoes : []) as OpcaoDeResposta[],
    atributo: l.atributo,
    formula: l.formula,
  };
}

export function paraPerguntaDeModelo(l: LinhaDePergunta): PerguntaDeModelo {
  return { ...paraPergunta(l), modo: l.modo };
}
