/** Funções puras da árvore de categorias (testadas em arvore.test.ts). */

export interface NoPlano {
  id: string;
  paiId: string | null;
  ordem: number;
  nome: string;
}

export type No<T extends NoPlano> = T & { filhas: No<T>[]; nivel: number };

/** Monta a árvore ordenada por `ordem` e, no empate, por nome. */
export function montarArvore<T extends NoPlano>(itens: T[]): No<T>[] {
  const porPai = new Map<string | null, T[]>();
  for (const i of itens) {
    const lista = porPai.get(i.paiId) ?? [];
    lista.push(i);
    porPai.set(i.paiId, lista);
  }
  const ordenar = (a: T, b: T) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR");
  const construir = (paiId: string | null, nivel: number): No<T>[] =>
    (porPai.get(paiId) ?? []).sort(ordenar).map((i) => ({ ...i, nivel, filhas: construir(i.id, nivel + 1) }));
  return construir(null, 0);
}

/** Lista os ids de todos os descendentes de `id`. */
export function descendentes(itens: NoPlano[], id: string): Set<string> {
  const resultado = new Set<string>();
  const fila = [id];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const i of itens) {
      if (i.paiId === atual && !resultado.has(i.id)) {
        resultado.add(i.id);
        fila.push(i.id);
      }
    }
  }
  return resultado;
}

/** Uma categoria não pode ser filha de si mesma nem de um descendente seu. */
export function paiValido(itens: NoPlano[], id: string, novoPaiId: string | null): boolean {
  if (novoPaiId === null) return true;
  if (novoPaiId === id) return false;
  return !descendentes(itens, id).has(novoPaiId);
}

/**
 * Calcula a nova ordem ao mover uma categoria entre suas irmãs.
 * Devolve as atualizações necessárias (ordens renumeradas de 0 a n-1).
 */
export function mover(
  irmas: NoPlano[],
  id: string,
  direcao: "cima" | "baixo",
): { id: string; ordem: number }[] {
  const lista = [...irmas].sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  const idx = lista.findIndex((i) => i.id === id);
  const alvo = direcao === "cima" ? idx - 1 : idx + 1;
  if (idx < 0 || alvo < 0 || alvo >= lista.length) return [];
  [lista[idx], lista[alvo]] = [lista[alvo]!, lista[idx]!];
  return lista.map((i, ordem) => ({ id: i.id, ordem }));
}
