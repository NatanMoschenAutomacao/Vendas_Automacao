import type { No, NoPlano } from "./arvore";

/** Lista achatada com recuo, para o seletor de categoria pai. */
export function opcoesDePai<T extends NoPlano>(arvore: No<T>[], excluir?: Set<string>) {
  const saida: { id: string; rotulo: string }[] = [];
  const visitar = (nos: No<T>[]) => {
    for (const n of nos) {
      if (excluir?.has(n.id)) continue;
      saida.push({ id: n.id, rotulo: `${"— ".repeat(n.nivel)}${n.nome}` });
      visitar(n.filhas);
    }
  };
  visitar(arvore);
  return saida;
}
