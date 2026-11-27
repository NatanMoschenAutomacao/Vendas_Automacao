import { describe, expect, it } from "vitest";
import {
  analisarFormula,
  avaliarCondicao,
  calcularFormula,
  descreverCondicao,
  ErroDeFormula,
  validarCondicao,
  variaveisDaFormula,
  type Condicao,
  type DescricaoDeVariavel,
  type Operador,
  type ValorSimples,
} from "../src";

const ctx = {
  "resposta.tipo_controle": "grupos",
  "resposta.qtd_grupos": 3,
  "modelo.tensao": 380,
  "modelo.comunicacao": ["RS485", "Pulso"],
  "base.quantidade": 10,
  "projeto.tem(estacao)": true,
};

describe("avaliarCondicao", () => {
  it("controle por grupos E tensão 380 V", () => {
    const c: Condicao = {
      tipo: "e",
      itens: [
        { tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "igual", valor: "grupos" },
        { tipo: "comparacao", variavel: "modelo.tensao", operador: "igual", valor: 380 },
      ],
    };
    expect(avaliarCondicao(c, ctx)).toBe(true);
    expect(avaliarCondicao(c, { ...ctx, "modelo.tensao": 220 })).toBe(false);
  });
  it("OU, NÃO e operadores", () => {
    const cmp = (variavel: string, operador: Operador, valor?: ValorSimples | ValorSimples[]) =>
      avaliarCondicao({ tipo: "comparacao", variavel, operador, valor }, ctx);
    expect(cmp("resposta.qtd_grupos", "maior", 2)).toBe(true);
    expect(cmp("resposta.qtd_grupos", "menor_igual", 2)).toBe(false);
    expect(cmp("resposta.qtd_grupos", "entre", [1, 3])).toBe(true);
    expect(cmp("resposta.tipo_controle", "em", ["simultaneo", "grupos"])).toBe(true);
    expect(cmp("modelo.comunicacao", "contem", "RS485")).toBe(true);
    expect(cmp("modelo.comunicacao", "contem", "4–20 mA")).toBe(false);
    expect(cmp("resposta.inexistente", "preenchido")).toBe(false);
    expect(cmp("resposta.inexistente", "diferente", "x")).toBe(false);
    expect(avaliarCondicao({ tipo: "nao", item: { tipo: "comparacao", variavel: "modelo.tensao", operador: "igual", valor: 220 } }, ctx)).toBe(true);
    expect(
      avaliarCondicao(
        { tipo: "ou", itens: [{ tipo: "comparacao", variavel: "modelo.tensao", operador: "igual", valor: 220 }, { tipo: "comparacao", variavel: "resposta.qtd_grupos", operador: "igual", valor: "3" }] },
        ctx,
      ),
    ).toBe(true);
  });
  it("sem condição é sempre verdadeiro", () => {
    expect(avaliarCondicao(null, {})).toBe(true);
    expect(avaliarCondicao({ tipo: "e", itens: [] }, {})).toBe(true);
  });
});

describe("validarCondicao", () => {
  const vars: DescricaoDeVariavel[] = [
    { nome: "modelo.tensao", rotulo: "Tensão", tipo: "numero", unidade: "V" },
    { nome: "resposta.tipo_controle", rotulo: "Tipo de controle", tipo: "lista", opcoes: ["grupos", "simultaneo"] },
  ];
  it("aceita condição correta", () => {
    expect(validarCondicao({ tipo: "comparacao", variavel: "modelo.tensao", operador: "maior", valor: 220 }, vars)).toEqual([]);
  });
  it("recusa variável inexistente e tipo errado", () => {
    expect(validarCondicao({ tipo: "comparacao", variavel: "modelo.vazao", operador: "igual", valor: 1 }, vars)).toEqual([
      'A variável "modelo.vazao" não existe aqui.',
    ]);
    expect(validarCondicao({ tipo: "comparacao", variavel: "modelo.tensao", operador: "igual", valor: "alta" }, vars)).toEqual([
      '"Tensão" é numérico: "alta" não é número.',
    ]);
    expect(validarCondicao({ tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "maior", valor: 1 }, vars)[0]).toContain("não é numérico");
    expect(validarCondicao({ tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "igual", valor: "outro" }, vars)).toEqual([
      '"Tipo de controle" não tem a opção "outro".',
    ]);
  });
  it("descreve em português", () => {
    expect(
      descreverCondicao(
        { tipo: "e", itens: [{ tipo: "comparacao", variavel: "modelo.tensao", operador: "igual", valor: 380 }, { tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "igual", valor: "grupos" }] },
        { "modelo.tensao": "Tensão" },
      ),
    ).toBe("Tensão é igual a 380 E resposta.tipo_controle é igual a grupos");
  });
});

describe("fórmulas", () => {
  it("calcula com precedência, funções e variáveis", () => {
    expect(calcularFormula("arredCima(base.quantidade / 4) * 2", ctx)).toBe(6);
    expect(calcularFormula("1 + 2 * 3", {})).toBe(7);
    expect(calcularFormula("(1 + 2) * 3", {})).toBe(9);
    expect(calcularFormula("-2 + max(1, 5, 3)", {})).toBe(3);
    expect(calcularFormula("arred(2.345, 2)", {})).toBe(2.35);
    expect(calcularFormula("arredBaixo(0.1 * 3 * 10)", {})).toBe(3);
    expect(calcularFormula('se(resposta.tipo_controle = "grupos", resposta.qtd_grupos, 1)', ctx)).toBe(3);
    expect(calcularFormula("se(modelo.tensao >= 380 e base.quantidade > 5, 1, 0)", ctx)).toBe(1);
    expect(calcularFormula('se(projeto.tem("estacao"), 2, 0)', ctx)).toBe(2);
    expect(calcularFormula("modelo.comunicacao", ctx)).toBe(2);
  });
  it("lista as variáveis", () => {
    expect([...variaveisDaFormula(analisarFormula("min(base.quantidade, resposta.qtd_grupos) + 1"))]).toEqual([
      "base.quantidade",
      "resposta.qtd_grupos",
    ]);
  });
  it("recusa entradas inválidas sem executar código", () => {
    const erro = (f: string, c = {}) => {
      try {
        calcularFormula(f, c);
        return null;
      } catch (e) {
        expect(e).toBeInstanceOf(ErroDeFormula);
        return (e as Error).message;
      }
    };
    expect(erro("1 +")).toBe("A fórmula termina antes do esperado.");
    expect(erro("(1 + 2")).toBe("Falta fechar um parêntese.");
    expect(erro("quantidade * 2")).toContain("Variável sem prefixo");
    expect(erro("eval(1)")).toBe("Função desconhecida: eval.");
    expect(erro("1 / 0")).toBe("Divisão por zero.");
    expect(erro("resposta.x + 1")).toBe('"resposta.x" não está preenchido.');
    expect(erro("constructor.prototype")).toBe('"constructor.prototype" não está preenchido.');
    expect(erro("1;2")).toContain("Caractere inesperado");
    expect(erro("1".repeat(501))).toContain("500 caracteres");
    expect(erro("(".repeat(40) + "1" + ")".repeat(40))).toContain("aninhados");
  });
});
