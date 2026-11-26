import { describe, expect, it } from "vitest";
import {
  atributosFaltantes,
  chaveDoRotulo,
  chaveValida,
  formatarAtributo,
  lerNumero,
  validarAtributos,
  type DefinicaoDeAtributo,
} from "../src/biblioteca/atributos";

const def = (d: Partial<DefinicaoDeAtributo> & Pick<DefinicaoDeAtributo, "chave" | "tipoDado">): DefinicaoDeAtributo => ({
  rotulo: d.chave,
  opcoes: [],
  obrigatorio: false,
  ...d,
});

describe("chaveDoRotulo", () => {
  it("remove acentos e símbolos", () => {
    expect(chaveDoRotulo("Potência (kW)")).toBe("potencia_kw");
    expect(chaveDoRotulo("Tensão")).toBe("tensao");
  });
  it("garante que começa com letra", () => {
    expect(chaveDoRotulo("4-20 mA")).toBe("c_4_20_ma");
    expect(chaveValida(chaveDoRotulo("4-20 mA"))).toBe(true);
  });
});

describe("lerNumero", () => {
  it("aceita vírgula e ponto", () => {
    expect(lerNumero("1,5")).toBe(1.5);
    expect(lerNumero("1.5")).toBe(1.5);
    expect(lerNumero("1.234,5")).toBe(1234.5);
    expect(lerNumero("-3")).toBe(-3);
  });
  it("recusa texto", () => {
    expect(lerNumero("abc")).toBeNull();
    expect(lerNumero("1,2,3")).toBeNull();
    expect(lerNumero("")).toBeNull();
  });
});

describe("validarAtributos", () => {
  const defs = [
    def({ chave: "potencia", tipoDado: "NUMERO", unidade: "kW", obrigatorio: true }),
    def({ chave: "fases", tipoDado: "LISTA", opcoes: ["Monofásico", "Trifásico"] }),
    def({ chave: "comunicacao", tipoDado: "MULTIPLA", opcoes: ["RS485", "Modbus RTU", "Pulso"] }),
    def({ chave: "inversor", tipoDado: "BOOLEANO" }),
    def({ chave: "obs", tipoDado: "TEXTO" }),
  ];

  it("converte valores válidos", () => {
    const r = validarAtributos(defs, {
      potencia: "7,5",
      fases: "Trifásico",
      comunicacao: ["Pulso", "RS485"],
      inversor: "sim",
      obs: "  ok ",
      extra: "ignorado",
    });
    expect(r.erros).toEqual({});
    expect(r.valores).toEqual({
      potencia: 7.5,
      fases: "Trifásico",
      comunicacao: ["RS485", "Pulso"],
      inversor: true,
      obs: "ok",
    });
  });

  it("aponta obrigatório, número e opção inválidos", () => {
    expect(validarAtributos(defs, {}).erros).toEqual({ potencia: "Campo obrigatório." });
    const r = validarAtributos(defs, { potencia: "x", fases: "Bifásico", comunicacao: "Wi-Fi" });
    expect(r.erros).toEqual({ potencia: "Informe um número.", fases: "Opção inválida.", comunicacao: "Opção inválida." });
  });

  it("omite campos vazios não obrigatórios", () => {
    expect(validarAtributos(defs, { potencia: "1", fases: "", obs: " " }).valores).toEqual({ potencia: 1 });
  });
});

describe("atributosFaltantes e formatarAtributo", () => {
  const p = def({ chave: "potencia", tipoDado: "NUMERO", unidade: "kW", obrigatorio: true });
  it("lista obrigatórios sem valor", () => {
    expect(atributosFaltantes([p], {})).toEqual(["potencia"]);
    expect(atributosFaltantes([p], { potencia: 0 })).toEqual([]);
  });
  it("formata com unidade e em pt-BR", () => {
    expect(formatarAtributo(p, 7.5)).toBe("7,5 kW");
    expect(formatarAtributo(def({ chave: "b", tipoDado: "BOOLEANO" }), false)).toBe("Não");
    expect(formatarAtributo(def({ chave: "m", tipoDado: "MULTIPLA" }), ["A", "B"])).toBe("A, B");
  });
});
