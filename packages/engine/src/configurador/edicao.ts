/**
 * Operações do configurador sobre a configuração do projeto (Fase 04).
 * Funções puras: recebem a configuração e devolvem uma nova, sem mutar a
 * original. O gerador de ids é injetado para manter o motor determinístico.
 */
import type { Pergunta, ValorDeResposta } from "../perguntas/tipos";
import type {
  ConfiguracaoDoProjeto,
  EquipamentoNoSnapshot,
  Id,
  InstanciaDeEquipamento,
  SnapshotDaBiblioteca,
} from "../types";

export type GeradorDeId = () => Id;

export interface ItemDeKitNoSnapshot {
  equipamentoId: Id;
  modeloId: Id | null;
  quantidade: number;
  respostas: Record<string, ValorDeResposta | null>;
}

export interface KitNoSnapshot {
  id: Id;
  nome: string;
  itens: ItemDeKitNoSnapshot[];
}

/** Modelo escolhido automaticamente: só quando há exatamente um modelo ativo. */
export function modeloPadrao(eq: EquipamentoNoSnapshot): Id | null {
  const ativos = eq.modelos.filter((m) => m.ativo);
  return ativos.length === 1 ? ativos[0]!.id : null;
}

export function novaInstancia(
  eq: EquipamentoNoSnapshot,
  gerarId: GeradorDeId,
  opcoes: { modeloId?: Id | null; quantidade?: number; respostas?: Record<string, ValorDeResposta | null>; kitId?: Id } = {},
): InstanciaDeEquipamento {
  const modeloValido =
    opcoes.modeloId && eq.modelos.some((m) => m.id === opcoes.modeloId && m.ativo) ? opcoes.modeloId : null;
  return {
    id: gerarId(),
    equipamentoId: eq.id,
    modeloId: modeloValido ?? modeloPadrao(eq),
    quantidade: opcoes.quantidade ?? 1,
    fornecimento: "fornecido",
    respostas: { ...(opcoes.respostas ?? {}) },
    ...(opcoes.kitId ? { kitId: opcoes.kitId } : {}),
  };
}

export function adicionarEquipamento(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
  equipamentoId: Id,
  gerarId: GeradorDeId,
  modeloId?: Id | null,
): { config: ConfiguracaoDoProjeto; instancia: InstanciaDeEquipamento | null } {
  const eq = snapshot.equipamentos?.[equipamentoId];
  if (!eq || !eq.ativo) return { config, instancia: null };
  const instancia = novaInstancia(eq, gerarId, { modeloId });
  return { config: { ...config, instancias: [...config.instancias, instancia] }, instancia };
}

/**
 * Aplica um kit: cada item vira uma instância nova com a quantidade e as
 * respostas padrão do kit. Itens de equipamento inativo ou removido são
 * ignorados e devolvidos em `ignorados` para a tela avisar.
 */
export function aplicarKit(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
  kit: KitNoSnapshot,
  gerarId: GeradorDeId,
): { config: ConfiguracaoDoProjeto; adicionadas: InstanciaDeEquipamento[]; ignorados: Id[] } {
  const adicionadas: InstanciaDeEquipamento[] = [];
  const ignorados: Id[] = [];
  for (const item of kit.itens) {
    const eq = snapshot.equipamentos?.[item.equipamentoId];
    if (!eq || !eq.ativo) {
      ignorados.push(item.equipamentoId);
      continue;
    }
    adicionadas.push(
      novaInstancia(eq, gerarId, {
        modeloId: item.modeloId,
        quantidade: item.quantidade,
        respostas: item.respostas,
        kitId: kit.id,
      }),
    );
  }
  return { config: { ...config, instancias: [...config.instancias, ...adicionadas] }, adicionadas, ignorados };
}

export function atualizarInstancia(
  config: ConfiguracaoDoProjeto,
  id: Id,
  mudanca: Partial<Omit<InstanciaDeEquipamento, "id" | "equipamentoId">>,
): ConfiguracaoDoProjeto {
  return { ...config, instancias: config.instancias.map((i) => (i.id === id ? { ...i, ...mudanca } : i)) };
}

export function responder(
  config: ConfiguracaoDoProjeto,
  id: Id,
  chave: string,
  valor: ValorDeResposta | null,
): ConfiguracaoDoProjeto {
  return {
    ...config,
    instancias: config.instancias.map((i) =>
      i.id === id ? { ...i, respostas: { ...(i.respostas ?? {}), [chave]: valor } } : i,
    ),
  };
}

export function removerInstancia(config: ConfiguracaoDoProjeto, id: Id): ConfiguracaoDoProjeto {
  return { ...config, instancias: config.instancias.filter((i) => i.id !== id) };
}

export function duplicarInstancia(config: ConfiguracaoDoProjeto, id: Id, gerarId: GeradorDeId): ConfiguracaoDoProjeto {
  const pos = config.instancias.findIndex((i) => i.id === id);
  if (pos < 0) return config;
  const orig = config.instancias[pos]!;
  const copia: InstanciaDeEquipamento = { ...orig, id: gerarId(), respostas: { ...(orig.respostas ?? {}) } };
  const instancias = [...config.instancias];
  instancias.splice(pos + 1, 0, copia);
  return { ...config, instancias };
}

/** Quantidade física total por equipamento (soma das quantidades das instâncias). */
export function quantidadePorEquipamento(config: ConfiguracaoDoProjeto): Record<Id, number> {
  const r: Record<Id, number> = {};
  for (const i of config.instancias) r[i.equipamentoId] = (r[i.equipamentoId] ?? 0) + (i.quantidade > 0 ? i.quantidade : 0);
  return r;
}

/**
 * Valor resultante de clicar numa opção (hotspot de opção): na seleção
 * múltipla alterna a opção; nos demais tipos passa a ser a resposta.
 */
export function valorAoEscolherOpcao(
  pergunta: Pergunta,
  atual: ValorDeResposta | null | undefined,
  valor: string,
): ValorDeResposta | null {
  if (pergunta.tipo !== "SELECAO_MULTIPLA") return atual === valor ? null : valor;
  const lista = Array.isArray(atual) ? atual : [];
  const novo = lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor];
  const ordem = pergunta.opcoes.map((o) => o.valor);
  return novo.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b));
}
