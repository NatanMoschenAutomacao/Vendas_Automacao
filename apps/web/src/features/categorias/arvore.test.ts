import { describe, expect, it } from "vitest";
import { descendentes, montarArvore, mover, paiValido } from "./arvore";

const itens = [
  { id: "clima", paiId: null, ordem: 0, nome: "Climatização" },
  { id: "irr", paiId: null, ordem: 1, nome: "Irrigação" },
  { id: "exa", paiId: "clima", ordem: 0, nome: "Exaustores" },
  { id: "pad", paiId: "clima", ordem: 1, nome: "Pad & Fan" },
  { id: "pad-a", paiId: "pad", ordem: 0, nome: "Sub" },
];

describe("árvore de categorias", () => {
  it("monta a árvore respeitando ordem e nível", () => {
    const a = montarArvore(itens);
    expect(a.map((n) => n.id)).toEqual(["clima", "irr"]);
    expect(a[0]!.filhas.map((n) => n.id)).toEqual(["exa", "pad"]);
    expect(a[0]!.filhas[1]!.filhas[0]!.nivel).toBe(2);
  });

  it("encontra todos os descendentes", () => {
    expect([...descendentes(itens, "clima")].sort()).toEqual(["exa", "pad", "pad-a"]);
  });

  it("impede referência circular", () => {
    expect(paiValido(itens, "clima", "clima")).toBe(false);
    expect(paiValido(itens, "clima", "pad-a")).toBe(false);
    expect(paiValido(itens, "pad", "irr")).toBe(true);
    expect(paiValido(itens, "pad", null)).toBe(true);
  });

  it("move entre irmãs e renumera as ordens", () => {
    const irmas = itens.filter((i) => i.paiId === "clima");
    expect(mover(irmas, "pad", "cima")).toEqual([
      { id: "pad", ordem: 0 },
      { id: "exa", ordem: 1 },
    ]);
    expect(mover(irmas, "exa", "cima")).toEqual([]);
    expect(mover(irmas, "pad", "baixo")).toEqual([]);
  });
});
