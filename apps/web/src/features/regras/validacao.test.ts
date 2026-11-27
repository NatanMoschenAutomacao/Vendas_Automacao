import { describe, expect, it } from "vitest";
import { validarRegra, type ContextoDaRegra } from "./validacao";
import type { DadosDaRegra } from "./schema";

const ITEM = "00000000-0000-4000-8000-000000000001";
const OUTRO = "00000000-0000-4000-8000-000000000002";
const DO = "00000000-0000-4000-8000-000000000003";

const ctx: ContextoDaRegra = {
  dono: "equipamento",
  comuns: [{ nome: "resposta.potencia", rotulo: "Potência", tipo: "numero" }],
  itens: new Set([ITEM, OUTRO]),
  recursos: new Set([DO]),
};

const base: DadosDaRegra = {
  codigo: "R1",
  nome: "Regra",
  descricao: null,
  estagio: "material",
  base: "por_acionamento",
  condicao: null,
  prioridade: 100,
  permiteRemocao: false,
  ativo: true,
  isDemo: true,
  efeitos: [{ acao: "adicionar", itemId: ITEM, formula: "base.quantidade * 2", arredondamento: "cima" }],
};

describe("validarRegra", () => {
  it("aceita uma regra coerente", () => {
    expect(validarRegra(base, ctx)).toEqual({});
  });

  it("recusa base que não pertence ao dono", () => {
    expect(validarRegra({ ...base, base: "por_painel" }, ctx).base).toBeTruthy();
  });

  it("recusa variável desconhecida e fórmula inválida", () => {
    const r = validarRegra(
      {
        ...base,
        efeitos: [
          { acao: "adicionar", itemId: ITEM, formula: "painel.tensao + 1", arredondamento: "nenhum" },
          { acao: "adicionar", itemId: ITEM, formula: "2 *", arredondamento: "nenhum" },
        ],
      },
      ctx,
    );
    expect(r["efeito-0"]).toMatch(/painel.tensao/);
    expect(r["efeito-1"]).toBeTruthy();
  });

  it("separa estágios de recurso e de material", () => {
    const r = validarRegra({ ...base, efeitos: [{ acao: "recurso", tipoRecursoId: DO, funcao: null, formula: "1" }] }, ctx);
    expect(r["efeito-0"]).toMatch(/Recurso/);
    expect(validarRegra({ ...base, estagio: "recurso", efeitos: [{ acao: "recurso", tipoRecursoId: DO, funcao: "Liga", formula: "base.quantidade" }] }, ctx)).toEqual({});
  });

  it("exige substituto diferente e existente", () => {
    expect(validarRegra({ ...base, efeitos: [{ acao: "substituir", itemId: ITEM, substitutoId: ITEM }] }, ctx)["efeito-0"]).toBeTruthy();
    expect(validarRegra({ ...base, efeitos: [{ acao: "substituir", itemId: ITEM, substitutoId: OUTRO }] }, ctx)).toEqual({});
  });

  it("aceita variáveis do painel em regra de tipo de painel", () => {
    expect(
      validarRegra(
        { ...base, base: "por_painel", efeitos: [{ acao: "adicionar", itemId: ITEM, formula: "se(painel.tensao > 220, 2, 1)", arredondamento: "nenhum" }] },
        { ...ctx, dono: "tipoDePainel", comuns: [] },
      ),
    ).toEqual({});
  });
});
