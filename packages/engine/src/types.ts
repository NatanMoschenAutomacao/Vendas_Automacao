/**
 * Tipos de entrada e saída do motor de cálculo.
 *
 * O motor é uma função pura: recebe a configuração do orçamento (escolhas do
 * vendedor) e um snapshot da biblioteca técnica, e devolve o resultado.
 * Não acessa banco, rede, relógio ou aleatoriedade.
 *
 * Cada fase acrescenta os campos do seu motor. Campos novos da configuração
 * são opcionais, para que rascunhos antigos continuem válidos.
 */
import type { Pergunta, PerguntaDeModelo, ValorDeResposta } from "./perguntas/tipos";
import type { ResultadoDasPerguntas } from "./perguntas/aplicabilidade";

export type Id = string;

/** Escolhas do vendedor. É o que fica salvo no rascunho do orçamento. */
export interface ConfiguracaoDoProjeto {
  schemaVersion: 1;
  instancias: InstanciaDeEquipamento[];
}

export interface InstanciaDeEquipamento {
  id: Id;
  equipamentoId: Id;
  modeloId: Id | null;
  quantidade: number;
  /** Equipamento fornecido pela Zanatta ou já existente no cliente (§33). */
  fornecimento: "fornecido" | "existente";
  /** Respostas às perguntas da instância, por chave. */
  respostas?: Record<string, ValorDeResposta | null>;
  /** Kit de onde a instância veio, se houver (só informativo). */
  kitId?: Id | null;
}

export interface ModeloNoSnapshot {
  id: Id;
  nome: string;
  ativo: boolean;
  atributos: Record<string, unknown>;
  perguntas: PerguntaDeModelo[];
}

export interface EquipamentoNoSnapshot {
  id: Id;
  /** Código do equipamento, usado em projeto.tem("codigo") e projeto.quantidade("codigo"). */
  codigo?: string;
  nome: string;
  ativo: boolean;
  perguntas: Pergunta[];
  modelos: ModeloNoSnapshot[];
}

/** Recorte imutável da biblioteca técnica usado num cálculo. */
export interface SnapshotDaBiblioteca {
  versao: string;
  equipamentos?: Record<Id, EquipamentoNoSnapshot>;
}

export type Gravidade = "informativa" | "advertencia" | "impeditiva";

export interface Pendencia {
  codigo: string;
  gravidade: Gravidade;
  mensagem: string;
  /** Onde corrigir (ex.: id da instância). */
  referencia?: Id;
}

export interface ResultadoDoCalculo {
  pendencias: Pendencia[];
  /** Perguntas avaliadas por instância (id da instância). */
  perguntas: Record<Id, ResultadoDasPerguntas>;
  /** Estágios executados, na ordem. Útil para depuração e testes. */
  estagios: NomeDoEstagio[];
}

export const ESTAGIOS = [
  "perguntas",
  "estrutura",
  "recursos",
  "controladores",
  "materiais",
  "ajustes",
  "precos",
  "pendencias",
] as const;

export type NomeDoEstagio = (typeof ESTAGIOS)[number];
