/**
 * Tipos da precificação (Fase 09).
 *
 * Valores em dinheiro trafegam como texto decimal ("1234.50") para não
 * perder precisão em JSON. Todo cálculo é feito em decimal exato.
 */
type Id = string;

/** Venda fixa: usa o preço de venda cadastrado. Custo + regra: aplica a regra comercial ao custo. Nunca os dois. */
export type ModoDePreco = "venda_fixa" | "custo_regra";

/** Preço vigente de um item do catálogo. */
export interface PrecoNoSnapshot {
  modo: ModoDePreco;
  custo: string | null;
  venda: string | null;
}

/** Regra comercial padrão aplicada aos itens em "custo + regra". */
export interface RegraComercial {
  tipo: "markup" | "margem";
  /** Percentual, ex.: "30" = 30%. */
  percentual: string;
}

export const GRUPOS_COMERCIAIS = ["material", "servico", "software"] as const;
export type GrupoComercial = (typeof GRUPOS_COMERCIAIS)[number];

/** Imposto da v1: linha percentual por grupo, sem cálculo fiscal (§33, decisão 11). */
export interface Imposto {
  id: Id;
  nome: string;
  grupo: GrupoComercial;
  percentual: string;
}

/** Desconto ou acréscimo comercial gravado na configuração do orçamento. */
export interface AjusteComercial {
  id: Id;
  tipo: "desconto" | "acrescimo";
  escopo: GrupoComercial | "total";
  modo: "percentual" | "valor";
  /** Percentual ("5" = 5%) ou valor em reais ("150.00"). */
  valor: string;
  justificativa: string;
  autor?: string | null;
  data?: string | null;
}

/** Serviço incluído à mão no orçamento. */
export interface ServicoNoProjeto {
  id: Id;
  servicoId: Id;
  quantidade: number;
}

/** Dados comerciais do orçamento (Fase 09). Textos só vão para a proposta. */
export interface DadosComerciais {
  ajustes?: AjusteComercial[];
  condicoesDePagamento?: string | null;
  prazoDeEntrega?: string | null;
  garantia?: string | null;
  validade?: string | null;
}

export interface LinhaDePreco {
  /** "m:<itemId>|<unidade>" ou "s:<servicoId>|<unidade>". */
  chave: string;
  tipo: "material" | "servico";
  grupo: GrupoComercial;
  itemId?: Id;
  servicoId?: Id;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  /** Modo usado nesta linha (rastreabilidade do §33). Null quando não há preço. */
  modo: ModoDePreco | null;
  /** Preço unitário de venda já arredondado para centavos. */
  unitario: string | null;
  /** Unitário × quantidade, arredondado para centavos. */
  total: string | null;
  semPreco: boolean;
  /** Só para quem vê custo. */
  custoUnitario?: string | null;
  custoTotal?: string | null;
  /** Chaves das linhas detalhadas (materiais ou serviços) que formam a quantidade. */
  chaves: string[];
}

export interface ValorDeAjuste {
  id: Id;
  tipo: AjusteComercial["tipo"];
  modo: AjusteComercial["modo"];
  percentual: string | null;
  /** Negativo para desconto, positivo para acréscimo. */
  valor: string;
  justificativa: string;
  autor?: string | null;
}

export interface ValorDeImposto {
  id: Id;
  nome: string;
  percentual: string;
  valor: string;
}

export interface TotalDoGrupo {
  grupo: GrupoComercial;
  /** Soma das linhas arredondadas. */
  subtotal: string;
  ajustes: ValorDeAjuste[];
  /** Subtotal com descontos e acréscimos do grupo. */
  liquido: string;
  impostos: ValorDeImposto[];
  /** Líquido + impostos. */
  total: string;
  /** Desconto líquido do grupo em percentual do subtotal (para o limite por perfil). */
  percentualDeDesconto: string;
  /** Algum item do grupo está sem preço. */
  parcial: boolean;
  custo?: string | null;
}

export interface ResultadoDePrecos {
  linhas: LinhaDePreco[];
  grupos: TotalDoGrupo[];
  /** Soma dos totais dos grupos. */
  subtotal: string;
  /** Descontos e acréscimos sobre o total geral. */
  ajustesGerais: ValorDeAjuste[];
  total: string;
  percentualDeDescontoGeral: string;
  /** Há linha sem preço: o total é parcial e a emissão fica bloqueada (cenário 15). */
  parcial: boolean;
  /** O servidor removeu custos (perfil vendedor). */
  custosOcultos: boolean;
  /** Só para quem vê custo: custo total e margem sobre a venda líquida (sem impostos). */
  custoTotal?: string | null;
  margem?: string | null;
}
