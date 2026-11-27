import { describe, expect, it } from "vitest";
import {
  arredondar,
  calcular,
  type ConfiguracaoDoProjeto,
  type RegraNoSnapshot,
  type SnapshotDaBiblioteca,
} from "../src";

// Todos os itens e regras são DEMO, criados só para os testes.
const item = (id: string, unidade = "pç", fracionavel = false, descricao = `Item ${id}`) => ({
  id,
  codigo: id.toUpperCase(),
  descricao,
  unidade,
  fracionavel,
  ativo: true,
});

const regra = (r: Partial<RegraNoSnapshot> & Pick<RegraNoSnapshot, "id" | "dono" | "efeitos">): RegraNoSnapshot => ({
  codigo: r.id.toUpperCase(),
  nome: r.id,
  estagio: "material",
  base: "por_equipamento",
  condicao: null,
  prioridade: 100,
  permiteRemocao: false,
  ativo: true,
  ...r,
});

function snap(regras: RegraNoSnapshot[]): SnapshotDaBiblioteca {
  return {
    versao: "t",
    equipamentos: {
      exa: {
        id: "exa",
        codigo: "EXAUSTOR",
        nome: "Exaustor DEMO",
        ativo: true,
        acionamento: { tipo: "individual" },
        perguntas: [
          {
            chave: "tipo_controle",
            texto: "Tipo de controle",
            tipo: "SELECAO_UNICA",
            obrigatoria: false,
            ordem: 0,
            opcoes: [
              { valor: "simultaneo", rotulo: "Simultâneo" },
              { valor: "grupos", rotulo: "Por grupos" },
            ],
          },
        ],
        modelos: [{ id: "m1", nome: "Modelo 01", ativo: true, atributos: { potencia: 1.5 }, perguntas: [], itemId: "exaustor" }],
      },
    },
    tiposDePainel: { ctrl: { id: "ctrl", nome: "Controle", ativo: true } },
    itens: {
      exaustor: item("exaustor"),
      contator: item("contator"),
      contator2: item("contator2"),
      cabo: item("cabo", "m", true, "Cabo PP"),
      cabo_rolo: item("cabo_rolo", "rl", false, "Cabo PP"),
      gabinete: item("gabinete"),
      rele: item("rele"),
    },
    tiposDeRecurso: { do: { id: "do", codigo: "DO", nome: "Saída digital", fisico: true, ativo: true } },
    regras,
  };
}

const exaustores = (q: number, extra: Partial<ConfiguracaoDoProjeto["instancias"][number]> = {}): ConfiguracaoDoProjeto => ({
  schemaVersion: 1,
  instancias: [{ id: "i1", equipamentoId: "exa", modeloId: "m1", quantidade: q, fornecimento: "fornecido", ...extra }],
});

describe("materiais (Fase 06)", () => {
  it("arredonda para cima itens não fracionáveis", () => {
    expect(arredondar(2.1, "nenhum", false)).toBe(3);
    expect(arredondar(2.1, "nenhum", true)).toBe(2.1);
    expect(arredondar(2.5, "baixo", true)).toBe(2);
    expect(arredondar(2.0000000001, "nenhum", false)).toBe(2);
  });

  it("gera fornecimento e composição por equipamento, com origem rastreável", () => {
    const s = snap([
      regra({ id: "r1", dono: { tipo: "equipamento", id: "exa" }, base: "por_acionamento", efeitos: [{ acao: "adicionar", itemId: "contator", formula: "base.quantidade", arredondamento: "nenhum" }] }),
      regra({ id: "r2", dono: { tipo: "modelo", id: "m1" }, efeitos: [{ acao: "adicionar", itemId: "cabo", formula: "base.quantidade * 7.5", arredondamento: "nenhum" }] }),
    ]);
    const r = calcular(exaustores(4), s);
    expect(r.materiais.consolidado.map((c) => [c.codigo, c.quantidade, c.unidade])).toEqual([
      ["CABO", 30, "m"],
      ["CONTATOR", 4, "pç"],
      ["EXAUSTOR", 4, "pç"],
    ]);
    const contator = r.materiais.linhas.find((l) => l.itemId === "contator")!;
    expect(contator.origem).toMatchObject({ tipo: "regra", regraCodigo: "R1", instanciaId: "i1", base: "por_acionamento", baseQuantidade: 4 });
    expect(contator.chave).toBe("R1:i:i1:CONTATOR");
  });

  it("instância existente não gera fornecimento, mas gera automação (cenário 17)", () => {
    const s = snap([regra({ id: "r1", dono: { tipo: "equipamento", id: "exa" }, efeitos: [{ acao: "adicionar", itemId: "contator", formula: "base.quantidade", arredondamento: "nenhum" }] })]);
    const r = calcular(exaustores(3, { fornecimento: "existente" }), s);
    expect(r.materiais.consolidado.map((c) => c.codigo)).toEqual(["CONTATOR"]);
  });

  it("totaliza por item + unidade, nunca pela descrição (cenários 07 e 08)", () => {
    const s = snap([
      regra({ id: "a", dono: { tipo: "equipamento", id: "exa" }, efeitos: [{ acao: "adicionar", itemId: "cabo", formula: "10", arredondamento: "nenhum" }] }),
      regra({ id: "b", dono: { tipo: "modelo", id: "m1" }, efeitos: [{ acao: "adicionar", itemId: "cabo", formula: "5", arredondamento: "nenhum" }] }),
      regra({ id: "c", dono: { tipo: "modelo", id: "m1" }, efeitos: [{ acao: "adicionar", itemId: "cabo_rolo", formula: "1", arredondamento: "nenhum" }] }),
    ]);
    const r = calcular(exaustores(1), s);
    const cabos = r.materiais.consolidado.filter((c) => c.descricao === "Cabo PP");
    expect(cabos.map((c) => [c.codigo, c.quantidade])).toEqual([
      ["CABO", 15],
      ["CABO_ROLO", 1],
    ]);
    expect(cabos[0]!.chaves).toHaveLength(2);
  });

  it("instância compartilhada gera linhas uma vez (cenário 09) e recalcular não acumula (cenário 16)", () => {
    const s = snap([regra({ id: "r1", dono: { tipo: "equipamento", id: "exa" }, efeitos: [{ acao: "adicionar", itemId: "contator", formula: "base.quantidade", arredondamento: "nenhum" }] })]);
    const c: ConfiguracaoDoProjeto = {
      ...exaustores(2, { ambientes: ["a1", "a2"] }),
      ambientes: [
        { id: "a1", nome: "G1" },
        { id: "a2", nome: "G2" },
      ],
    };
    const r1 = calcular(c, s);
    expect(r1.materiais.consolidado.find((x) => x.codigo === "CONTATOR")!.quantidade).toBe(2);
    expect(calcular(c, s)).toEqual(r1);
  });

  it("componentes gerais do painel saem uma vez por painel, não por equipamento", () => {
    const s = snap([regra({ id: "g", dono: { tipo: "tipoDePainel", id: "ctrl" }, base: "por_painel", efeitos: [{ acao: "adicionar", itemId: "gabinete", formula: "1", arredondamento: "nenhum" }] })]);
    const c: ConfiguracaoDoProjeto = {
      ...exaustores(10, { painelId: "p1" }),
      paineis: [
        { id: "p1", identificacao: "QC-01", tipoId: "ctrl", tensao: 220, ambientes: [] },
        { id: "p2", identificacao: "QC-02", tipoId: "ctrl", tensao: 220, ambientes: [] },
      ],
    };
    const gab = calcular(c, s).materiais.linhas.filter((l) => l.itemId === "gabinete");
    expect(gab.map((l) => [l.origem.painelId, l.quantidade])).toEqual([
      ["p1", 1],
      ["p2", 1],
    ]);
  });

  it("aplica condição sobre respostas e a ordem adicionar → substituir → quantidade → remover", () => {
    const s = snap([
      regra({ id: "add", dono: { tipo: "equipamento", id: "exa" }, permiteRemocao: true, efeitos: [{ acao: "adicionar", itemId: "contator", formula: "base.quantidade", arredondamento: "nenhum" }, { acao: "adicionar", itemId: "rele", formula: "1", arredondamento: "nenhum" }] }),
      regra({
        id: "sub",
        dono: { tipo: "equipamento", id: "exa" },
        prioridade: 200,
        condicao: { tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "igual", valor: "grupos" },
        efeitos: [{ acao: "substituir", itemId: "contator", substitutoId: "contator2" }, { acao: "quantidade", itemId: "contator2", formula: "base.quantidade * 2", arredondamento: "nenhum" }, { acao: "remover", itemId: "rele" }],
      }),
    ]);
    const sem = calcular(exaustores(3), s);
    expect(sem.materiais.consolidado.map((c) => c.codigo)).toEqual(["CONTATOR", "EXAUSTOR", "RELE"]);
    const com = calcular(exaustores(3, { respostas: { tipo_controle: "grupos" } }), s);
    expect(com.materiais.consolidado.map((c) => [c.codigo, c.quantidade])).toEqual([
      ["CONTATOR2", 6],
      ["EXAUSTOR", 3],
    ]);
    // A chave da linha substituída continua a mesma, para os ajustes manuais.
    expect(com.materiais.linhas.find((l) => l.itemId === "contator2")!.chave).toBe("ADD:i:i1:CONTATOR");
  });

  it("recusa remoção não permitida e aponta conflito de mesma prioridade", () => {
    const add = regra({ id: "add", dono: { tipo: "equipamento", id: "exa" }, efeitos: [{ acao: "adicionar", itemId: "rele", formula: "1", arredondamento: "nenhum" }] });
    const rem = regra({ id: "rem", dono: { tipo: "equipamento", id: "exa" }, prioridade: 200, efeitos: [{ acao: "remover", itemId: "rele" }] });
    const r = calcular(exaustores(1), snap([add, rem]));
    expect(r.materiais.consolidado.map((c) => c.codigo)).toContain("RELE");
    expect(r.pendencias.map((p) => p.codigo)).toContain("REMOCAO_NAO_PERMITIDA");
    const conflito = calcular(exaustores(1), snap([{ ...add, permiteRemocao: true }, { ...rem, prioridade: 100 }]));
    expect(conflito.pendencias.map((p) => p.codigo)).toContain("REGRA_CONFLITO");
    expect(conflito.materiais.consolidado.map((c) => c.codigo)).toContain("RELE");
  });

  it("quantidade negativa e fórmula inválida viram pendência impeditiva", () => {
    const s = snap([
      regra({ id: "neg", dono: { tipo: "equipamento", id: "exa" }, efeitos: [{ acao: "adicionar", itemId: "rele", formula: "1 - base.quantidade", arredondamento: "nenhum" }] }),
      regra({ id: "err", dono: { tipo: "equipamento", id: "exa" }, efeitos: [{ acao: "adicionar", itemId: "rele", formula: "modelo.inexistente * 2", arredondamento: "nenhum" }] }),
    ]);
    const r = calcular(exaustores(3), s);
    expect(r.pendencias.filter((p) => p.gravidade === "impeditiva").map((p) => p.codigo)).toEqual(expect.arrayContaining(["QUANTIDADE_NEGATIVA", "FORMULA_ERRO"]));
    expect(r.materiais.consolidado.map((c) => c.codigo)).toEqual(["EXAUSTOR"]);
  });

  it("gera recursos de automação e a lista de I/O por painel", () => {
    const s = snap([
      regra({ id: "io", dono: { tipo: "equipamento", id: "exa" }, estagio: "recurso", base: "por_acionamento", efeitos: [{ acao: "recurso", tipoRecursoId: "do", funcao: "comando", formula: "base.quantidade" }] }),
    ]);
    const c: ConfiguracaoDoProjeto = { ...exaustores(5, { painelId: "p1" }), paineis: [{ id: "p1", identificacao: "QC", tipoId: "ctrl", tensao: null, ambientes: [] }] };
    const r = calcular(c, s);
    expect(r.materiais.io).toEqual([{ painelId: "p1", tipoRecursoId: "do", codigo: "DO", fisico: true, quantidade: 5 }]);
    expect(r.materiais.sinais[0]).toMatchObject({ funcao: "comando", origem: { instanciaId: "i1" } });
  });

  it("reaplica ajustes manuais e aponta os que perderam a linha", () => {
    const s = snap([regra({ id: "r1", dono: { tipo: "equipamento", id: "exa" }, efeitos: [{ acao: "adicionar", itemId: "contator", formula: "base.quantidade", arredondamento: "nenhum" }] })]);
    const c: ConfiguracaoDoProjeto = {
      ...exaustores(2),
      ajustes: [
        { id: "aj1", acao: "quantidade", chave: "R1:i:i1:CONTATOR", quantidade: 5, justificativa: "Reserva pedida pelo cliente" },
        { id: "aj2", acao: "adicionar", itemId: "cabo", quantidade: 12.5, justificativa: "Cabo extra" },
        { id: "aj3", acao: "remover", chave: "R9:i:i1:XYZ", justificativa: "Antigo" },
        { id: "aj4", acao: "remover", chave: "fornecimento:i:i1:EXAUSTOR", justificativa: "" },
      ],
    };
    const r = calcular(c, s);
    expect(r.materiais.consolidado.map((x) => [x.codigo, x.quantidade])).toEqual([
      ["CABO", 12.5],
      ["CONTATOR", 5],
      ["EXAUSTOR", 2],
    ]);
    expect(r.pendencias.map((p) => `${p.codigo}:${p.referencia}`)).toEqual(expect.arrayContaining(["AJUSTE_CONFLITO:aj3", "AJUSTE_SEM_JUSTIFICATIVA:aj4"]));
  });
});
