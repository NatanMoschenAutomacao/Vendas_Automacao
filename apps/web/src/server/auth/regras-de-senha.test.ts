import { describe, expect, it } from "vitest";
import { BLOQUEIO_MINUTOS, MAX_TENTATIVAS, registrarFalha, senhaSchema } from "./regras-de-senha";

describe("regras de senha", () => {
  it("exige 8 caracteres com letras e números", () => {
    expect(senhaSchema.safeParse("curta1").success).toBe(false);
    expect(senhaSchema.safeParse("somenteletras").success).toBe(false);
    expect(senhaSchema.safeParse("12345678").success).toBe(false);
    expect(senhaSchema.safeParse("senhaBoa1").success).toBe(true);
  });

  it("bloqueia após o limite de tentativas", () => {
    const agora = new Date("2026-01-01T12:00:00Z");
    expect(registrarFalha(0, agora)).toEqual({ tentativasFalhas: 1, bloqueadoAte: null });
    const r = registrarFalha(MAX_TENTATIVAS - 1, agora);
    expect(r.tentativasFalhas).toBe(0);
    expect(r.bloqueadoAte?.getTime()).toBe(agora.getTime() + BLOQUEIO_MINUTOS * 60_000);
  });
});
