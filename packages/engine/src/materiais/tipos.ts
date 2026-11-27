/**
 * Tipos do catálogo central, das regras de composição/recursos e do
 * resultado de materiais (Fase 06).
 */
import type { Condicao } from "../regras/condicao";

type Id = string;

export interface ItemNoSnapshot {
  id: Id;
  codigo: string;
  descricao: string;
  unidade: string;
  /** Unidade que aceita fração (m, kg). Itens não fracionáveis são sempre arredondados para cima. */
  fracionavel: boolean;
  ativo: boolean;
  /** Grupo comercial do item: material (padrão) ou software (Fase 09). */
  grupo?: "material" | "software";
}

/** Serviço do catálogo (Fase 09). Valor é sempre venda fixa; custo é opcional. */
export interface ServicoNoSnapshot {
  id: Id;
  codigo: string;
  descricao: string;
  unidade: string;
  fracionavel: boolean;
  /** Decimal em texto ("1234.5"). Null = sem preço. */
  valor: string | null;
  custo: string | null;
  ativo: boolean;
}

export interface TipoDeRecursoNoSnapshot {
  id: Id;
  codigo: string;
  nome: string;
  /** Ponto físico de I/O (DI, DO, AI, AO) ou não (SP, comunicação). */
  fisico: boolean;
  ativo: boolean;
}

export type DonoDaRegra =
  | { tipo: "equipamento"; id: Id }
  | { tipo: "modelo"; id: Id }
  | { tipo: "tipoDePainel"; id: Id }
  | { tipo: "controlador"; id: Id }
  | { tipo: "projeto" };

export const BASES_DE_CALCULO = [
  "por_equipamento",
  "por_acionamento",
  "por_protecao",
  "uma_vez_por_item",
  "por_painel",
  "por_grupo",
  "por_setor",
  "por_ambiente",
  "por_controlador",
  "por_projeto",
] as const;
export type BaseDeCalculo = (typeof BASES_DE_CALCULO)[number];

/** Bases aceitas por tipo de dono. */
export const BASES_POR_DONO: Record<DonoDaRegra["tipo"], readonly BaseDeCalculo[]> = {
  equipamento: ["por_equipamento", "por_acionamento", "por_protecao", "uma_vez_por_item"],
  modelo: ["por_equipamento", "por_acionamento", "por_protecao", "uma_vez_por_item"],
  tipoDePainel: ["por_painel"],
  controlador: ["por_controlador"],
  projeto: ["por_projeto", "por_painel", "por_grupo", "por_setor", "por_ambiente", "por_controlador"],
};

export type Arredondamento = "nenhum" | "cima" | "baixo" | "proximo";

export type EfeitoDaRegra =
  | { acao: "adicionar"; itemId: Id; formula: string; arredondamento: Arredondamento }
  | { acao: "substituir"; itemId: Id; substitutoId: Id }
  | { acao: "quantidade"; itemId: Id; formula: string; arredondamento: Arredondamento }
  | { acao: "remover"; itemId: Id }
  | { acao: "recurso"; tipoRecursoId: Id; funcao: string | null; formula: string }
  | { acao: "servico"; servicoId: Id; formula: string; arredondamento: Arredondamento };

export interface RegraNoSnapshot {
  id: Id;
  codigo: string;
  nome: string;
  dono: DonoDaRegra;
  estagio: "recurso" | "material" | "servico";
  base: BaseDeCalculo;
  condicao: Condicao | null;
  prioridade: number;
  /** Permite que outra regra remova os itens adicionados por esta. */
  permiteRemocao: boolean;
  ativo: boolean;
  efeitos: EfeitoDaRegra[];
}

/** De onde veio uma linha: rastreabilidade do §22. */
export interface OrigemDaLinha {
  /** "fornecimento" = o próprio equipamento; "ajuste" = ajuste manual; "manual" = serviço incluído à mão. */
  tipo: "regra" | "fornecimento" | "ajuste" | "controlador" | "cartao" | "manual";
  regraId?: Id;
  regraCodigo?: string;
  instanciaId?: Id;
  painelId?: Id;
  grupoId?: Id;
  setorId?: Id;
  ambienteId?: Id;
  /** Controlador do projeto (id local), Fase 07. */
  controladorId?: Id;
  base?: BaseDeCalculo;
  baseQuantidade?: number;
}

export interface LinhaDeMaterial {
  /** Chave estável: regra + contexto + item. Ajustes manuais apontam para ela. */
  chave: string;
  itemId: Id;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  origem: OrigemDaLinha;
  /** Ajuste manual aplicado sobre a linha, se houver. */
  ajustadaPor?: Id;
}

/** Linha de serviço gerada por regra (estágio de serviços) ou incluída à mão. */
export interface LinhaDeServico {
  chave: string;
  servicoId: Id;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  origem: OrigemDaLinha;
}

export interface LinhaConsolidada {
  itemId: Id;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
  /** Chaves das linhas detalhadas que formam a quantidade. */
  chaves: string[];
}

export interface SinalDeIO {
  chave: string;
  tipoRecursoId: Id;
  codigo: string;
  fisico: boolean;
  funcao: string | null;
  quantidade: number;
  painelId: Id | null;
  origem: OrigemDaLinha;
}

export interface ResumoDeIO {
  painelId: Id | null;
  tipoRecursoId: Id;
  codigo: string;
  fisico: boolean;
  quantidade: number;
}

/** Ajuste manual do vendedor ou do administrador (gravado na configuração). */
export interface AjusteManual {
  id: Id;
  acao: "quantidade" | "remover" | "adicionar";
  /** Linha automática ajustada (quantidade/remover). */
  chave?: string | null;
  /** Item da adição livre. */
  itemId?: Id | null;
  quantidade?: number | null;
  justificativa: string;
  autor?: string | null;
  data?: string | null;
}

export interface ResultadoDeMateriais {
  linhas: LinhaDeMaterial[];
  consolidado: LinhaConsolidada[];
  sinais: SinalDeIO[];
  io: ResumoDeIO[];
  /** Serviços gerados por regras e incluídos à mão (Fase 09). */
  servicos: LinhaDeServico[];
}
