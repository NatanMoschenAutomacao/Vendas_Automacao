import { describe, expect, it } from "vitest";
import {
  avaliarPerguntas,
  detectarCiclo,
  resolverPerguntas,
  type Pergunta,
  type PerguntaDeModelo,
} from "../src";

const p = (x: Partial<Pergunta> & Pick<Pergunta, "chave" | "tipo">): Pergunta => ({
  texto: x.chave,
  obrigatoria: false,
  ordem: 0,
  opcoes: [],
  ...x,
});

const tipoControle = p({
  chave: "tipo_controle",
  tipo: "SELECAO_UNICA",
  obrigatoria: true,
  ordem: 1,
  opcoes: [
    { valor: "simultaneo", rotulo: "Simultâneo" },
    { valor: "grupos", rotulo: "Por grupos" },
  ],
});
const qtdGrupos = p({
  chave: "qtd_grupos",
  tipo: "INTEIRO",
  obrigatoria: true,
  minimo: 1,
  maximo: 10,
  ordem: 2,
  condicao: { tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "igual", valor: "grupos" },
});
const porGrupo = p({
  chave: "por_grupo",
  tipo: "CALCULADO",
  ordem: 3,
  formula: "arredCima(instancia.quantidade / resposta.qtd_grupos)",
  condicao: { tipo: "comparacao", variavel: "resposta.qtd_grupos", operador: "preenchido" },
});

describe("herança equipamento → modelo", () => {
  const eq = [tipoControle, qtdGrupos];
  it("ausente herda, substituir troca, ocultar remove, nova acrescenta", () => {
    const modelo: PerguntaDeModelo[] = [
      { ...qtdGrupos, modo: "SUBSTITUIR", texto: "Quantos grupos (máx. 4)?", maximo: 4 },
      { ...p({ chave: "inversor", tipo: "SIM_NAO", ordem: 9 }), modo: "NOVA" },
    ];
    const r = resolverPerguntas(eq, modelo);
    expect(r.erros).toEqual([]);
    expect(r.perguntas.map((x) => [x.chave, x.origem])).toEqual([
      ["tipo_controle", "equipamento"],
      ["qtd_grupos", "modelo"],
      ["inversor", "modelo"],
    ]);
    expect(r.perguntas[1]!.maximo).toBe(4);
    expect(resolverPerguntas(eq, [{ ...tipoControle, modo: "OCULTAR" }]).perguntas.map((x) => x.chave)).toEqual(["qtd_grupos"]);
  });
  it("recusa duplicidade e substituição sem base", () => {
    expect(resolverPerguntas(eq, [{ ...tipoControle, modo: "NOVA" }]).erros[0]).toContain("já existe no equipamento");
    expect(resolverPerguntas(eq, [{ ...p({ chave: "x", tipo: "SIM_NAO" }), modo: "OCULTAR" }]).erros[0]).toContain("não tem essa pergunta");
  });
});

describe("aplicabilidade", () => {
  const perguntas = [porGrupo, qtdGrupos, tipoControle];
  it("mostra a dependente só quando a condição vale", () => {
    const simultaneo = avaliarPerguntas(perguntas, { tipo_controle: "simultaneo", qtd_grupos: 3 }, { "instancia.quantidade": 8 });
    expect(simultaneo.itens.map((i) => [i.pergunta.chave, i.visivel])).toEqual([
      ["tipo_controle", true],
      ["qtd_grupos", false],
      ["por_grupo", false],
    ]);
    // Resposta oculta continua guardada, mas não participa do cálculo.
    expect(simultaneo.valores).toEqual({ tipo_controle: "simultaneo" });
    expect(simultaneo.pendencias).toEqual([]);

    const grupos = avaliarPerguntas(perguntas, { tipo_controle: "grupos", qtd_grupos: 3 }, { "instancia.quantidade": 8 });
    expect(grupos.valores).toEqual({ tipo_controle: "grupos", qtd_grupos: 3, por_grupo: 3 });
  });
  it("obrigatória e limites só em perguntas visíveis", () => {
    expect(avaliarPerguntas(perguntas, {}).pendencias.map((x) => x.codigo)).toEqual(["PERGUNTA_OBRIGATORIA"]);
    const r = avaliarPerguntas(perguntas, { tipo_controle: "grupos", qtd_grupos: 30 }, {}, "inst-1");
    expect(r.pendencias).toEqual([
      { codigo: "RESPOSTA_INVALIDA", gravidade: "impeditiva", mensagem: '"qtd_grupos": O máximo é 10.', referencia: "inst-1" },
    ]);
    expect(r.valores.qtd_grupos).toBeUndefined();
  });
  it("usa o padrão e informação automática do modelo", () => {
    const info = p({ chave: "potencia", tipo: "INFORMACAO", atributo: "potencia", ordem: 0 });
    const r = avaliarPerguntas([info, { ...tipoControle, padrao: "simultaneo" }], {}, { "modelo.potencia": 1.5 });
    expect(r.valores).toEqual({ potencia: 1.5, tipo_controle: "simultaneo" });
  });
  it("opção com condição fica indisponível", () => {
    const comCondicao = {
      ...tipoControle,
      opcoes: [
        tipoControle.opcoes[0]!,
        { ...tipoControle.opcoes[1]!, condicao: { tipo: "comparacao" as const, variavel: "instancia.quantidade", operador: "maior" as const, valor: 1 } },
      ],
    };
    const r = avaliarPerguntas([comCondicao], { tipo_controle: "grupos" }, { "instancia.quantidade": 1 });
    expect(r.itens[0]!.opcoes.map((o) => o.valor)).toEqual(["simultaneo"]);
    expect(r.pendencias[0]!.codigo).toBe("RESPOSTA_INVALIDA");
  });
});

describe("ciclos", () => {
  it("detecta A → B → A e mostra o caminho", () => {
    const a = p({ chave: "a", tipo: "SIM_NAO", condicao: { tipo: "comparacao", variavel: "resposta.b", operador: "igual", valor: true } });
    const b = p({ chave: "b", tipo: "CALCULADO", formula: "se(resposta.a, 1, 0)" });
    expect(detectarCiclo([a, b])).toEqual(["a", "b", "a"]);
    expect(avaliarPerguntas([a, b], {}).pendencias[0]!.codigo).toBe("PERGUNTA_CICLO");
  });
  it("sem ciclo devolve null", () => {
    expect(detectarCiclo([tipoControle, qtdGrupos, porGrupo])).toBeNull();
  });
});
