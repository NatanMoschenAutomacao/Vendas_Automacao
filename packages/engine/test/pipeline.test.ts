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

describe("calcular com perguntas (Fase 04)", () => {
  const snap = {
    versao: "t",
    equipamentos: {
      e1: {
        id: "e1",
        nome: "Exaustor",
        ativo: true,
        perguntas: [
          {
            chave: "tipo_controle",
            texto: "Tipo de controle",
            tipo: "SELECAO_UNICA" as const,
            obrigatoria: true,
            ordem: 0,
            opcoes: [
              { valor: "simultaneo", rotulo: "Simultâneo" },
              { valor: "grupos", rotulo: "Por grupos" },
            ],
          },
        ],
        modelos: [{ id: "m1", nome: "Modelo 01", ativo: true, atributos: { potencia: 1.5 }, perguntas: [] }],
      },
    },
  };
  it("aponta pergunta obrigatória por instância", () => {
    const r = calcular(
      { schemaVersion: 1, instancias: [{ id: "i1", equipamentoId: "e1", modeloId: "m1", quantidade: 2, fornecimento: "fornecido" }] },
      snap,
    );
    expect(r.pendencias).toEqual([
      { codigo: "PERGUNTA_OBRIGATORIA", gravidade: "impeditiva", mensagem: 'Responda "Tipo de controle".', referencia: "i1" },
    ]);
    const ok = calcular(
      {
        schemaVersion: 1,
        instancias: [
          { id: "i1", equipamentoId: "e1", modeloId: "m1", quantidade: 2, fornecimento: "fornecido", respostas: { tipo_controle: "grupos" } },
        ],
      },
      snap,
    );
    expect(ok.pendencias).toEqual([]);
    expect(ok.perguntas.i1!.valores).toEqual({ tipo_controle: "grupos" });
  });
  it("modelo inativado ou equipamento removido viram pendência", () => {
    const r = calcular(
      {
        schemaVersion: 1,
        instancias: [
          { id: "i1", equipamentoId: "e1", modeloId: "mX", quantidade: 1, fornecimento: "fornecido", respostas: { tipo_controle: "grupos" } },
          { id: "i2", equipamentoId: "eX", modeloId: null, quantidade: 1, fornecimento: "fornecido" },
        ],
      },
      snap,
    );
    expect(r.pendencias.map((p) => p.codigo)).toEqual(["EQUIPAMENTO_INDISPONIVEL", "EQUIPAMENTO_SEM_MODELO", "MODELO_INDISPONIVEL"]);
  });
});
