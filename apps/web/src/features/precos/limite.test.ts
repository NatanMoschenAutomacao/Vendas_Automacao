import { describe, expect, it } from "vitest";
import type { AjusteComercial } from "@zanatta/engine";
import { verificarLimiteDeDesconto } from "./limite";

const d = (id: string, valor: string, extra: Partial<AjusteComercial> = {}): AjusteComercial => ({
  id,
  tipo: "desconto",
  escopo: "material",
  modo: "percentual",
  valor,
  justificativa: "teste",
  ...extra,
});

describe("limite de desconto do vendedor", () => {
  it("aceita descontos percentuais dentro do limite, somados por escopo", () => {
    expect(verificarLimiteDeDesconto([d("a", "3"), d("b", "2"), d("c", "5", { escopo: "total" })], [], "5")).toBeNull();
    expect(verificarLimiteDeDesconto([d("a", "3"), d("b", "2.5")], [], "5")).toMatch(/limite de 5%/);
  });

  it("recusa desconto em valor e ignora acréscimos", () => {
    expect(verificarLimiteDeDesconto([d("a", "10", { modo: "valor" })], [], "50")).toMatch(/administrador/);
    expect(verificarLimiteDeDesconto([d("a", "80", { tipo: "acrescimo" })], [], "0")).toBeNull();
  });

  it("descontos já salvos e não alterados ficam fora da conta", () => {
    const doAdmin = d("adm", "20", { modo: "valor" });
    expect(verificarLimiteDeDesconto([doAdmin, d("v", "5")], [doAdmin], "5")).toBeNull();
    expect(verificarLimiteDeDesconto([{ ...doAdmin, valor: "30" }], [doAdmin], "5")).toMatch(/administrador/);
  });
});
