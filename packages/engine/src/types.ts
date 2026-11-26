/**
 * Tipos de entrada e saída do motor de cálculo.
 *
 * O motor é uma função pura: recebe a configuração do orçamento (escolhas do
 * vendedor) e um snapshot da biblioteca técnica, e devolve o resultado.
 * Não acessa banco, rede, relógio ou aleatoriedade.
 *
 * Nesta fase (01) os tipos cobrem apenas o contrato. Cada fase seguinte
 * acrescenta os campos do seu motor.
 */

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
}

/** Recorte imutável da biblioteca técnica usado num cálculo. */
export interface SnapshotDaBiblioteca {
  versao: string;
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
