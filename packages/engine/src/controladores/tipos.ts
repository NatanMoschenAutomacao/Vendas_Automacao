/**
 * Controladores (Fase 07): biblioteca, controladores do projeto e análise
 * de funções, recursos e compatibilidade.
 */
type Id = string;

export const TIPOS_DE_CONTROLADOR = ["convencional", "digital", "clp", "irrigacao", "ihm"] as const;
export type TipoDeControlador = (typeof TIPOS_DE_CONTROLADOR)[number];

export interface SaidaFuncionalNoSnapshot {
  id: Id;
  /** SP1, SP2… */
  codigo: string;
  /** Funções de controle que a saída suporta. */
  funcoes: Id[];
}

export interface ControladorNoSnapshot {
  id: Id;
  /** Item do catálogo que representa o controlador (preço e lista de materiais). */
  itemId: Id | null;
  codigo: string;
  nome: string;
  tipo: TipoDeControlador;
  ativo: boolean;
  /** Tensões de alimentação aceitas (V). Vazio = não cadastrado. */
  tensoes: number[];
  protocolos: string[];
  /** Recursos integrados por tipo de recurso (id → quantidade). */
  recursos: Record<Id, number>;
  saidas: SaidaFuncionalNoSnapshot[];
  /** Modelos de equipamento compatíveis. Vazio = compatibilidade não cadastrada. */
  modelosCompativeis: Id[];
}

/** Controlador escolhido pelo vendedor para o projeto (entrada do motor). */
export interface ControladorNoProjeto {
  id: Id;
  nome: string;
  /** Controlador da biblioteca. Null enquanto o vendedor não escolheu. */
  controladorId: Id | null;
  painelId: Id | null;
  /** Distribuição escolhida: grupo → saída funcional. Grupos ausentes são distribuídos sozinhos. */
  distribuicao?: Record<Id, Id>;
}

export interface SaidaDistribuida {
  grupoId: Id;
  saidaId: Id | null;
  saidaCodigo: string | null;
  /** true quando veio da escolha do vendedor. */
  manual: boolean;
}

export interface RecursoDoControlador {
  tipoRecursoId: Id;
  codigo: string;
  necessario: number;
  integrado: number;
  deficit: number;
}

/** O que um controlador precisa atender. */
export interface DemandaDoControlador {
  grupos: { id: Id; nome: string; funcaoId: Id | null }[];
  instancias: { id: Id; modeloId: Id | null; painelId: Id | null }[];
  recursos: Record<Id, number>;
  tensao: number | null;
}

export interface AnaliseDeCompatibilidade {
  controladorId: Id;
  compativel: boolean;
  /** Motivos de incompatibilidade (funções, recursos, modelos, tensão). */
  motivos: string[];
  distribuicao: SaidaDistribuida[];
  recursos: RecursoDoControlador[];
  /** Compatibilidade de modelos sem cadastro: aceita, mas avisa. */
  semListaDeModelos: boolean;
}

export interface AnaliseDoControlador extends Partial<AnaliseDeCompatibilidade> {
  id: Id;
  grupos: Id[];
  instancias: Id[];
  /** Alternativas da biblioteca para a mesma demanda (compatíveis primeiro). */
  alternativas: { controladorId: Id; compativel: boolean; motivos: string[] }[];
}

export interface ResultadoDosControladores {
  porControlador: AnaliseDoControlador[];
  /** Grupos com função e sem controlador. */
  gruposSemControlador: Id[];
  /** Sinais que não chegaram a nenhum controlador, por tipo de recurso. */
  sinaisSemControlador: { tipoRecursoId: Id; codigo: string; quantidade: number }[];
}
