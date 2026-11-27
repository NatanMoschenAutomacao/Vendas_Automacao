import { describe, expect, it } from "vitest";
import { interpretarPlanilha, lerTabela } from "./importacao";

describe("importação de itens por planilha", () => {
  it("lê texto colado do Excel (tabulação) e CSV com aspas", () => {
    expect(lerTabela("a\tb\n1\t2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(lerTabela('codigo;descricao\nX1;"Cabo; 2 vias ""PP"""')).toEqual([
      ["codigo", "descricao"],
      ["X1", 'Cabo; 2 vias "PP"'],
    ]);
  });

  it("valida cada linha e aponta erros sem perder as outras", () => {
    const r = interpretarPlanilha(
      ["Código\tDescrição\tUnidade\tCategoria\tFracionável", "dm-1\tCabo DEMO\tm\tCabos\tsim", "\tSem código\tpç\t\t", "DM-1\tRepetido\tpç\t\t"].join("\n"),
    );
    expect(r.erroGeral).toBeUndefined();
    expect(r.linhas[0]).toEqual({
      linha: 2,
      dados: {
        codigo: "DM-1",
        descricao: "Cabo DEMO",
        unidade: "m",
        fracionavel: true,
        codigoFabricante: null,
        fabricante: null,
        modelo: null,
        fornecedor: null,
        categoria: "Cabos",
      },
    });
    expect(r.linhas[1]!.erro).toMatch(/^codigo:/);
    expect(r.linhas[2]!.erro).toBe("código DM-1 repetido na planilha.");
  });

  it("exige as colunas obrigatórias", () => {
    expect(interpretarPlanilha("codigo;descricao\nA;B").erroGeral).toBe('Falta a coluna "unidade".');
  });
});
