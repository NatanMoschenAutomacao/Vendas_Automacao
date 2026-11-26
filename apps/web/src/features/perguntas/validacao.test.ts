import { describe, expect, it } from "vitest";
import type { Pergunta, PerguntaDeModelo } from "@zanatta/engine";
import type { DadosDaPergunta } from "./schema";
import { validarPergunta, type ContextoDeValidacao } from "./validacao";

const base: DadosDaPergunta = {
  chave: "qtd_grupos",
  modo: "NOVA",
  texto: "Quantos grupos?",
  ajuda: null,
  tipo: "INTEIRO",
  unidade: null,
  obrigatoria: true,
  minimo: 1,
  maximo: 10,
  passo: null,
  padrao: null,
  condicao: { tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "igual", valor: "grupos" },
  opcoes: [],
  atributo: null,
  formula: null,
  ativo: true,
};

const tipoControle: Pergunta = {
  chave: "tipo_controle",
  texto: "Tipo de controle",
  tipo: "SELECAO_UNICA",
  obrigatoria: true,
  ordem: 0,
  opcoes: [
    { valor: "simultaneo", rotulo: "Simultâneo" },
    { valor: "grupos", rotulo: "Por grupos" },
  ],
};

const ctx = (x: Partial<ContextoDeValidacao> = {}): ContextoDeValidacao => ({
  dono: "equipamento",
  doEquipamento: [tipoControle],
  porModelo: new Map(),
  definicoes: [{ chave: "tensao", rotulo: "Tensão", tipoDado: "NUMERO", unidade: "V", opcoes: [] }],
  ...x,
});

describe("validarPergunta", () => {
  it("aceita pergunta correta", () => {
    expect(validarPergunta(base, 1, ctx())).toEqual({});
  });
  it("recusa chave repetida e limites invertidos", () => {
    expect(validarPergunta({ ...base, chave: "tipo_controle" }, 1, ctx()).chave).toContain("Já existe");
    expect(validarPergunta({ ...base, minimo: 5, maximo: 2 }, 1, ctx()).maximo).toBeDefined();
  });
  it("recusa variável inexistente e tipo errado na condição", () => {
    expect(
      validarPergunta({ ...base, condicao: { tipo: "comparacao", variavel: "modelo.tensao", operador: "igual", valor: "alta" } }, 1, ctx()).condicao,
    ).toContain("não é número");
    expect(
      validarPergunta({ ...base, condicao: { tipo: "comparacao", variavel: "resposta.nao_existe", operador: "preenchido" } }, 1, ctx()).condicao,
    ).toContain("não existe");
  });
  it("recusa referência circular mostrando o caminho", () => {
    const dependente: Pergunta = { ...tipoControle, condicao: { tipo: "comparacao", variavel: "resposta.qtd_grupos", operador: "preenchido" } };
    const r = validarPergunta(base, 1, ctx({ doEquipamento: [dependente] }));
    expect(r.geral).toBe("Referência circular: tipo_controle depende de qtd_grupos depende de tipo_controle.");
  });
  it("modelo: exige Substituir/Ocultar para chave do equipamento", () => {
    const m = ctx({ dono: "modelo", modeloId: "m1", porModelo: new Map<string, PerguntaDeModelo[]>([["m1", []]]) });
    expect(validarPergunta({ ...base, chave: "tipo_controle", tipo: "SIM_NAO", condicao: null }, 1, m).modo).toContain("Substituir ou Ocultar");
    expect(validarPergunta({ ...base, chave: "tipo_controle", modo: "OCULTAR" }, 1, m)).toEqual({});
    expect(validarPergunta({ ...base, chave: "outra", modo: "SUBSTITUIR" }, 1, m).modo).toContain("não tem pergunta");
  });
  it("campo calculado valida a fórmula", () => {
    const calc = { ...base, tipo: "CALCULADO" as const, condicao: null, minimo: null, maximo: null };
    expect(validarPergunta({ ...calc, formula: "arredCima(instancia.quantidade / 2)" }, 1, ctx())).toEqual({});
    expect(validarPergunta({ ...calc, formula: "resposta.xyz * 2" }, 1, ctx()).formula).toContain("inexistente");
    expect(validarPergunta({ ...calc, formula: "1 +" }, 1, ctx()).formula).toContain("termina");
  });
});
