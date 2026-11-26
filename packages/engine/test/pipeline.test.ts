import { describe, expect, it } from "vitest";
import { calcular, ESTAGIOS, type ConfiguracaoDoProjeto } from "../src";

const snapshot = { versao: "demo" };

describe("calcular", () => {
  it("executa os estágios na ordem definida", () => {
    const r = calcular({ schemaVersion: 1, instancias: [] }, snapshot);
    expect(r.estagios).toEqual([...ESTAGIOS]);
    expect(r.pendencias).toEqual([]);
  });

  it("aponta quantidade inválida e equipamento sem modelo como impeditivas", () => {
    const config: ConfiguracaoDoProjeto = {
      schemaVersion: 1,
      instancias: [
        { id: "i1", equipamentoId: "e1", modeloId: null, quantidade: 0, fornecimento: "fornecido" },
      ],
    };
    const r = calcular(config, snapshot);
    expect(r.pendencias.map((p) => p.codigo)).toEqual([
      "EQUIPAMENTO_SEM_MODELO",
      "QUANTIDADE_INVALIDA",
    ]);
    expect(r.pendencias.every((p) => p.gravidade === "impeditiva")).toBe(true);
  });

  it("é determinístico: mesmas entradas, mesmo resultado (cenário 16)", () => {
    const config: ConfiguracaoDoProjeto = {
      schemaVersion: 1,
      instancias: [
        { id: "b", equipamentoId: "e1", modeloId: null, quantidade: 2, fornecimento: "existente" },
        { id: "a", equipamentoId: "e1", modeloId: null, quantidade: 1, fornecimento: "fornecido" },
      ],
    };
    const r1 = calcular(config, snapshot);
    const r2 = calcular(calcular(config, snapshot) && config, snapshot);
    expect(r2).toEqual(r1);
    expect(r1.pendencias).toHaveLength(2);
  });
});
