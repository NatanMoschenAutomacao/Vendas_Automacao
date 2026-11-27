import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { calcular, type ConfiguracaoDoProjeto, type SnapshotDaBiblioteca } from "@zanatta/engine";
import { montarDocumento, type CabecalhoDoDocumento } from "./modelo";
import { gerarPlanilha } from "./excel";
import { gerarPdf } from "./pdf";

// Dados DEMO, só para o teste: preços com dízimas para forçar arredondamento.
const snapshot: SnapshotDaBiblioteca = {
  versao: "t",
  equipamentos: {
    exa: { id: "exa", codigo: "EXAUSTOR", nome: "Exaustor DEMO", ativo: true, perguntas: [], modelos: [{ id: "m1", nome: "Modelo 01", ativo: true, atributos: {}, perguntas: [], itemId: "exaustor" }] },
  },
  itens: {
    exaustor: { id: "exaustor", codigo: "EXA-01", descricao: "Exaustor DEMO", unidade: "pç", fracionavel: false, ativo: true },
    cabo: { id: "cabo", codigo: "CB-01", descricao: "Cabo DEMO", unidade: "m", fracionavel: true, ativo: true },
  },
  precos: { exaustor: { modo: "custo_regra", custo: "1234.567", venda: null }, cabo: { modo: "custo_regra", custo: "3.333", venda: null } },
  regraComercial: { tipo: "margem", percentual: "27.5" },
  impostos: [{ id: "t", nome: "Imposto DEMO", grupo: "material", percentual: "3.65" }],
  regras: [
    {
      id: "r",
      codigo: "R",
      nome: "r",
      dono: { tipo: "equipamento", id: "exa" },
      estagio: "material",
      base: "por_equipamento",
      condicao: null,
      prioridade: 100,
      permiteRemocao: false,
      ativo: true,
      efeitos: [{ acao: "adicionar", itemId: "cabo", formula: "base.quantidade * 7.3", arredondamento: "nenhum" }],
    },
  ],
  modelosDeTexto: [{ id: "t1", secao: "equipamentos", dono: { tipo: "modelo", id: "m1" }, texto: "{{quantidade}} {{plural:exaustor|exaustores}} {{modelo.nome}}.", condicao: null, ordem: 0, ativo: true }],
};

const config: ConfiguracaoDoProjeto = {
  schemaVersion: 1,
  instancias: [{ id: "i1", equipamentoId: "exa", modeloId: "m1", quantidade: 7, fornecimento: "fornecido" }],
  comercial: { ajustes: [{ id: "d", tipo: "desconto", escopo: "total", modo: "percentual", valor: "3.3", justificativa: "teste" }], garantia: "12 meses DEMO" },
};

const cabecalho: CabecalhoDoDocumento = { numero: "2026-0001", revisao: 1, cliente: "Cliente DEMO", empresa: null, projeto: "Projeto DEMO", cidade: "Chapecó", uf: "SC", vendedor: "Vendedor DEMO", data: "27/11/2026", status: "Emitido" };

describe("documentos (Fase 10)", () => {
  const resultado = calcular(config, snapshot);

  it("planilha usa exatamente os valores da tela, linha a linha e no total (cenário 18)", async () => {
    const doc = montarDocumento({ tipo: "interno", previa: false, cabecalho, configuracao: config, resultado, snapshot });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await gerarPlanilha(doc)) as unknown as ArrayBuffer);
    const precos = wb.getWorksheet("Preços")!;
    for (const l of resultado.precos.linhas) {
      const linha = precos.getRows(2, precos.rowCount)!.find((r) => r.getCell(2).value === l.codigo)!;
      expect(linha.getCell(7).value).toBe(Number(l.total));
    }
    const resumo = wb.getWorksheet("Resumo")!;
    const total = resumo.getRows(1, resumo.rowCount)!.find((r) => r.getCell(1).value === "Total geral")!;
    expect(total.getCell(2).value).toBe(Number(resultado.precos.total));
    // E o total bate com a soma das linhas arredondadas, como na tela.
    const material = resultado.precos.grupos[0]!;
    expect(Math.round(resultado.precos.linhas.reduce((s, l) => s + Number(l.total) * 100, 0))).toBe(Math.round(Number(material.subtotal) * 100));
    expect(wb.getWorksheet("Lista detalhada")!.rowCount).toBe(resultado.materiais.linhas.length + 1);
  });

  it("proposta não leva custo, margem nem pendências", () => {
    const doc = montarDocumento({ tipo: "proposta", previa: true, cabecalho, configuracao: config, resultado, snapshot });
    expect(doc.precos.custoTotal).toBeUndefined();
    expect(doc.precos.linhas.every((l) => l.custoTotal === undefined)).toBe(true);
    expect(doc.pendencias).toEqual([]);
    expect(doc.condicoes).toEqual([{ rotulo: "Garantia", valor: "12 meses DEMO" }]);
    expect(doc.descritivo[0]!.paragrafos[0]!.texto).toBe("7 exaustores Modelo 01.");
  });

  it("gera o PDF", async () => {
    const pdf = await gerarPdf(montarDocumento({ tipo: "interno", previa: true, cabecalho, configuracao: config, resultado, snapshot }));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  }, 30_000);
});
