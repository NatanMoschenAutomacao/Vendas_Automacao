/** Edição imutável dos controladores do projeto (usada pelo configurador). */
import type { ConfiguracaoDoProjeto, Id } from "../types";
import type { ControladorNoProjeto } from "./tipos";

export function adicionarControlador(c: ConfiguracaoDoProjeto, id: Id, nome: string, painelId: Id | null = null): ConfiguracaoDoProjeto {
  const novo: ControladorNoProjeto = { id, nome: nome.trim() || "Controlador", controladorId: null, painelId };
  return { ...c, controladores: [...(c.controladores ?? []), novo] };
}

export function atualizarControlador(
  c: ConfiguracaoDoProjeto,
  id: Id,
  mudanca: Partial<Omit<ControladorNoProjeto, "id">>,
): ConfiguracaoDoProjeto {
  return {
    ...c,
    controladores: (c.controladores ?? []).map((x) => {
      if (x.id !== id) return x;
      const novo = { ...x, ...mudanca };
      // Trocar o modelo do controlador invalida a distribuição escolhida.
      if (mudanca.controladorId !== undefined && mudanca.controladorId !== x.controladorId) delete novo.distribuicao;
      return novo;
    }),
  };
}

/** Remove o controlador e solta grupos e itens ligados a ele. */
export function removerControlador(c: ConfiguracaoDoProjeto, id: Id): ConfiguracaoDoProjeto {
  return {
    ...c,
    controladores: (c.controladores ?? []).filter((x) => x.id !== id),
    grupos: c.grupos?.map((g) => (g.controladorId === id ? { ...g, controladorId: null } : g)),
    instancias: c.instancias.map((i) => (i.controladorId === id ? { ...i, controladorId: null } : i)),
  };
}

export function ligarGrupoAoControlador(c: ConfiguracaoDoProjeto, grupoId: Id, controladorId: Id | null): ConfiguracaoDoProjeto {
  return { ...c, grupos: c.grupos?.map((g) => (g.id === grupoId ? { ...g, controladorId } : g)) };
}

export function ligarInstanciaAoControlador(c: ConfiguracaoDoProjeto, instanciaId: Id, controladorId: Id | null): ConfiguracaoDoProjeto {
  return { ...c, instancias: c.instancias.map((i) => (i.id === instanciaId ? { ...i, controladorId } : i)) };
}

/** Define (ou devolve ao automático, com saidaId = null) a saída funcional de um grupo. */
export function definirSaidaDoGrupo(c: ConfiguracaoDoProjeto, controladorId: Id, grupoId: Id, saidaId: Id | null): ConfiguracaoDoProjeto {
  return {
    ...c,
    controladores: (c.controladores ?? []).map((x) => {
      if (x.id !== controladorId) return x;
      const distribuicao = { ...(x.distribuicao ?? {}) };
      if (saidaId) {
        // A saída passa a ser deste grupo: tira de quem a usava.
        for (const [g, s] of Object.entries(distribuicao)) if (s === saidaId) delete distribuicao[g];
        distribuicao[grupoId] = saidaId;
      } else delete distribuicao[grupoId];
      return { ...x, distribuicao };
    }),
  };
}
