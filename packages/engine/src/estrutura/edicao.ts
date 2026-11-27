/**
 * Edição da estrutura do projeto: ambientes, setores, painéis e grupos.
 * Remover um elemento limpa todas as referências a ele, para que a
 * configuração nunca aponte para algo que não existe.
 */
import type { GeradorDeId } from "../configurador/edicao";
import type { Ambiente, ConfiguracaoDoProjeto, GrupoDeControle, Id, Painel, Setor } from "../types";

const nomeLimpo = (nome: string) => nome.trim().slice(0, 120);

export function adicionarAmbiente(config: ConfiguracaoDoProjeto, nome: string, gerarId: GeradorDeId) {
  const ambiente: Ambiente = { id: gerarId(), nome: nomeLimpo(nome) };
  return { config: { ...config, ambientes: [...(config.ambientes ?? []), ambiente] }, ambiente };
}

export function renomearAmbiente(config: ConfiguracaoDoProjeto, id: Id, nome: string): ConfiguracaoDoProjeto {
  return { ...config, ambientes: (config.ambientes ?? []).map((a) => (a.id === id ? { ...a, nome: nomeLimpo(nome) } : a)) };
}

export function removerAmbiente(config: ConfiguracaoDoProjeto, id: Id): ConfiguracaoDoProjeto {
  const setoresRemovidos = new Set((config.setores ?? []).filter((s) => s.ambienteId === id).map((s) => s.id));
  return {
    ...config,
    ambientes: (config.ambientes ?? []).filter((a) => a.id !== id),
    setores: (config.setores ?? []).filter((s) => s.ambienteId !== id),
    paineis: (config.paineis ?? []).map((p) => ({ ...p, ambientes: p.ambientes.filter((a) => a !== id) })),
    instancias: config.instancias.map((i) => ({
      ...i,
      ambientes: (i.ambientes ?? []).filter((a) => a !== id),
      setorId: i.setorId && setoresRemovidos.has(i.setorId) ? null : (i.setorId ?? null),
    })),
  };
}

export function adicionarSetor(config: ConfiguracaoDoProjeto, ambienteId: Id, nome: string, gerarId: GeradorDeId) {
  const setor: Setor = { id: gerarId(), ambienteId, nome: nomeLimpo(nome) };
  return { config: { ...config, setores: [...(config.setores ?? []), setor] }, setor };
}

export function renomearSetor(config: ConfiguracaoDoProjeto, id: Id, nome: string): ConfiguracaoDoProjeto {
  return { ...config, setores: (config.setores ?? []).map((s) => (s.id === id ? { ...s, nome: nomeLimpo(nome) } : s)) };
}

export function removerSetor(config: ConfiguracaoDoProjeto, id: Id): ConfiguracaoDoProjeto {
  return {
    ...config,
    setores: (config.setores ?? []).filter((s) => s.id !== id),
    instancias: config.instancias.map((i) => (i.setorId === id ? { ...i, setorId: null } : i)),
  };
}

export function adicionarPainel(config: ConfiguracaoDoProjeto, identificacao: string, gerarId: GeradorDeId) {
  const painel: Painel = { id: gerarId(), identificacao: nomeLimpo(identificacao), tipoId: null, tensao: null, ambientes: [] };
  return { config: { ...config, paineis: [...(config.paineis ?? []), painel] }, painel };
}

export function atualizarPainel(config: ConfiguracaoDoProjeto, id: Id, mudanca: Partial<Omit<Painel, "id">>): ConfiguracaoDoProjeto {
  return { ...config, paineis: (config.paineis ?? []).map((p) => (p.id === id ? { ...p, ...mudanca } : p)) };
}

export function removerPainel(config: ConfiguracaoDoProjeto, id: Id): ConfiguracaoDoProjeto {
  return {
    ...config,
    paineis: (config.paineis ?? []).filter((p) => p.id !== id),
    instancias: config.instancias.map((i) => (i.painelId === id ? { ...i, painelId: null } : i)),
  };
}

export function adicionarGrupo(config: ConfiguracaoDoProjeto, nome: string, gerarId: GeradorDeId) {
  const grupo: GrupoDeControle = { id: gerarId(), nome: nomeLimpo(nome), funcaoId: null, membros: [] };
  return { config: { ...config, grupos: [...(config.grupos ?? []), grupo] }, grupo };
}

export function atualizarGrupo(
  config: ConfiguracaoDoProjeto,
  id: Id,
  mudanca: Partial<Omit<GrupoDeControle, "id" | "membros">>,
): ConfiguracaoDoProjeto {
  return { ...config, grupos: (config.grupos ?? []).map((g) => (g.id === id ? { ...g, ...mudanca } : g)) };
}

export function removerGrupo(config: ConfiguracaoDoProjeto, id: Id): ConfiguracaoDoProjeto {
  return { ...config, grupos: (config.grupos ?? []).filter((g) => g.id !== id) };
}

/**
 * Define quantas unidades da instância pertencem ao grupo (0 remove).
 * Um grupo aceita modelos diferentes e várias instâncias.
 */
export function definirMembro(config: ConfiguracaoDoProjeto, grupoId: Id, instanciaId: Id, quantidade: number): ConfiguracaoDoProjeto {
  const q = Number.isFinite(quantidade) ? Math.max(0, Math.floor(quantidade)) : 0;
  return {
    ...config,
    grupos: (config.grupos ?? []).map((g) => {
      if (g.id !== grupoId) return g;
      const outros = g.membros.filter((m) => m.instanciaId !== instanciaId);
      const pos = g.membros.findIndex((m) => m.instanciaId === instanciaId);
      if (q === 0) return { ...g, membros: outros };
      const membros = [...g.membros];
      if (pos >= 0) membros[pos] = { instanciaId, quantidade: q };
      else membros.push({ instanciaId, quantidade: q });
      return { ...g, membros };
    }),
  };
}

/** Remove a instância de todos os grupos (usado ao excluir um item). */
export function retirarDosGrupos(config: ConfiguracaoDoProjeto, instanciaId: Id): ConfiguracaoDoProjeto {
  if (!config.grupos?.length) return config;
  return { ...config, grupos: config.grupos.map((g) => ({ ...g, membros: g.membros.filter((m) => m.instanciaId !== instanciaId) })) };
}
