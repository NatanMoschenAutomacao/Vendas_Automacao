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
import type { ResultadoDaEstrutura } from "./estrutura/estrutura";
import type { AjusteManual, ItemNoSnapshot, RegraNoSnapshot, ResultadoDeMateriais, ServicoNoSnapshot, TipoDeRecursoNoSnapshot } from "./materiais/tipos";
import type { EdicaoDoDescritivo, ModeloDeTextoNoSnapshot, SecaoGerada } from "./descritivo/descritivo";
import type { DadosComerciais, Imposto, PrecoNoSnapshot, RegraComercial, ResultadoDePrecos, ServicoNoProjeto } from "./precos/tipos";
import type { CartaoNoSnapshot, ControladorNoProjeto, ControladorNoSnapshot, ReservaTecnica, ResultadoDosControladores } from "./controladores/tipos";

export type Id = string;

/** Escolhas do vendedor. É o que fica salvo no rascunho do orçamento. */
export interface ConfiguracaoDoProjeto {
  schemaVersion: 1;
  instancias: InstanciaDeEquipamento[];
  /** Estrutura do projeto (Fase 05). Opcionais para rascunhos antigos. */
  ambientes?: Ambiente[];
  setores?: Setor[];
  paineis?: Painel[];
  grupos?: GrupoDeControle[];
  /** Ajustes manuais da lista de materiais (Fase 06). */
  ajustes?: AjusteManual[];
  /** Controladores escolhidos para o projeto (Fase 07). */
  controladores?: ControladorNoProjeto[];
  /** Reserva técnica do projeto (só o administrador técnico altera). Null = padrão global. Fase 08. */
  reserva?: ReservaTecnica | null;
  /** Serviços incluídos à mão (Fase 09). */
  servicos?: ServicoNoProjeto[];
  /** Descontos, acréscimos e condições comerciais (Fase 09). */
  comercial?: DadosComerciais;
  /** Trechos do descritivo editados à mão, por chave do trecho (Fase 10). */
  descritivo?: { edicoes?: Record<string, EdicaoDoDescritivo> };
}

export interface Ambiente {
  id: Id;
  nome: string;
}

export interface Setor {
  id: Id;
  ambienteId: Id;
  nome: string;
}

export interface Painel {
  id: Id;
  identificacao: string;
  tipoId: Id | null;
  /** Tensão de comando/alimentação informada pelo vendedor (V). */
  tensao: number | null;
  /** Ambientes atendidos pelo painel. */
  ambientes: Id[];
}

/** Grupo de controle: entidade própria, com membros de uma ou mais instâncias (§18). */
export interface GrupoDeControle {
  id: Id;
  nome: string;
  funcaoId: Id | null;
  membros: MembroDeGrupo[];
  /** Controlador do projeto responsável pelo grupo (Fase 07). */
  controladorId?: Id | null;
}

export interface MembroDeGrupo {
  instanciaId: Id;
  quantidade: number;
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
  /** Ambientes atendidos. Mais de um = compartilhado, contado uma vez só. */
  ambientes?: Id[];
  setorId?: Id | null;
  painelId?: Id | null;
  /** Controlador do projeto ligado diretamente (sensores, itens fora de grupo). Fase 07. */
  controladorId?: Id | null;
}

/** Como acionamentos e proteções são derivados de um modelo (§18). */
export interface Derivacao {
  tipo: "nenhum" | "individual" | "coletivo";
  /** No coletivo: quantas unidades cada acionamento/proteção atende. */
  porGrupo?: number | null;
}

export interface ModeloNoSnapshot {
  id: Id;
  nome: string;
  ativo: boolean;
  atributos: Record<string, unknown>;
  perguntas: PerguntaDeModelo[];
  /** Substitui a regra do equipamento quando presente. */
  acionamento?: Derivacao | null;
  protecao?: Derivacao | null;
  /** Item do catálogo fornecido quando o equipamento é da Zanatta. */
  itemId?: Id | null;
}

export interface EquipamentoNoSnapshot {
  id: Id;
  /** Código do equipamento, usado em projeto.tem("codigo") e projeto.quantidade("codigo"). */
  codigo?: string;
  nome: string;
  ativo: boolean;
  perguntas: Pergunta[];
  modelos: ModeloNoSnapshot[];
  acionamento?: Derivacao | null;
  protecao?: Derivacao | null;
}

export interface TipoDePainelNoSnapshot {
  id: Id;
  nome: string;
  ativo: boolean;
}

export interface FuncaoDeControleNoSnapshot {
  id: Id;
  codigo: string;
  nome: string;
  ativo: boolean;
}

/** Recorte imutável da biblioteca técnica usado num cálculo. */
export interface SnapshotDaBiblioteca {
  versao: string;
  equipamentos?: Record<Id, EquipamentoNoSnapshot>;
  tiposDePainel?: Record<Id, TipoDePainelNoSnapshot>;
  funcoes?: Record<Id, FuncaoDeControleNoSnapshot>;
  itens?: Record<Id, ItemNoSnapshot>;
  tiposDeRecurso?: Record<Id, TipoDeRecursoNoSnapshot>;
  regras?: RegraNoSnapshot[];
  controladores?: Record<Id, ControladorNoSnapshot>;
  cartoes?: Record<Id, CartaoNoSnapshot>;
  /** Reserva técnica padrão das configurações gerais. */
  reservaPadrao?: ReservaTecnica | null;
  /** Fase 09: catálogo de serviços, preços vigentes por item, regra comercial e impostos. */
  servicos?: Record<Id, ServicoNoSnapshot>;
  precos?: Record<Id, PrecoNoSnapshot>;
  regraComercial?: RegraComercial | null;
  impostos?: Imposto[];
  /** O servidor removeu custos e regra comercial (perfil sem "precos:ver-custo"). */
  custosOcultos?: boolean;
  /** Modelos de texto do descritivo técnico (Fase 10). */
  modelosDeTexto?: ModeloDeTextoNoSnapshot[];
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
  /** Contagens da estrutura (Fase 05). */
  estrutura: ResultadoDaEstrutura;
  /** Materiais, consolidação e lista preliminar de I/O (Fase 06). */
  materiais: ResultadoDeMateriais;
  /** Análise dos controladores do projeto (Fase 07). */
  controladores: ResultadoDosControladores;
  /** Preços, totais, descontos e impostos (Fase 09). */
  precos: ResultadoDePrecos;
  /** Descritivo técnico montado a partir dos modelos de texto (Fase 10). */
  descritivo: SecaoGerada[];
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
