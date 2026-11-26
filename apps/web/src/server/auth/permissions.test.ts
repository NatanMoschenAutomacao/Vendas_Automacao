import { describe, expect, it } from "vitest";
import { ACOES, pode } from "./permissions";

describe("permissões", () => {
  it("administrador técnico pode tudo", () => {
    for (const a of ACOES) expect(pode("ADMIN_TECNICO", a)).toBe(true);
  });

  it("vendedor não vê custos nem altera a biblioteca (§43)", () => {
    expect(pode("VENDEDOR", "orcamento:criar")).toBe(true);
    expect(pode("VENDEDOR", "biblioteca:gerenciar")).toBe(false);
    expect(pode("VENDEDOR", "precos:ver-custo")).toBe(false);
    expect(pode("VENDEDOR", "usuarios:gerenciar")).toBe(false);
  });
});
