/**
 * Planilha do orçamento (ExcelJS). Os valores vêm dos textos decimais do
 * motor, convertidos célula a célula, sem fórmulas: o que a planilha mostra
 * é exatamente o que a tela e o PDF mostram (cenário 18).
 */
import ExcelJS from "exceljs";
import type { DocumentoDoOrcamento } from "./modelo";

const MOEDA = '"R$" #,##0.00';
const QTD = "#,##0.####";
const GRUPO = { material: "Materiais", servico: "Serviços", software: "Software" } as const;
const VERDE = "FF1F7A3A";

const num = (v: string | null | undefined) => (v === null || v === undefined || v === "" ? null : Number(v));

function cabecalho(ws: ExcelJS.Worksheet, colunas: { titulo: string; largura: number; formato?: string }[]) {
  ws.columns = colunas.map((c) => ({ header: c.titulo, width: c.largura, style: c.formato ? { numFmt: c.formato } : {} }));
  const r = ws.getRow(1);
  r.font = { bold: true, color: { argb: "FFFFFFFF" } };
  r.fill = { type: "pattern", pattern: "solid", fgColor: { argb: VERDE } };
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export async function gerarPlanilha(doc: DocumentoDoOrcamento): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Configurador de Automação";
  const c = doc.cabecalho;
  const verCusto = !doc.precos.custosOcultos;

  // Resumo
  const resumo = wb.addWorksheet("Resumo");
  resumo.columns = [{ width: 34 }, { width: 22 }];
  const linhasResumo: [string, string | number | null][] = [
    ["Orçamento", `${c.numero} (revisão ${c.revisao})`],
    ["Cliente", c.cliente],
    ["Empresa", c.empresa],
    ["Projeto", c.projeto],
    ["Cidade", [c.cidade, c.uf].filter(Boolean).join("/") || null],
    ["Vendedor", c.vendedor],
    ["Data", c.data],
    ["Situação", doc.previa ? `${c.status} (prévia, não emitido)` : c.status],
  ];
  for (const l of linhasResumo) resumo.addRow(l);
  resumo.addRow([]);
  for (const g of doc.precos.grupos) {
    resumo.addRow([`${GRUPO[g.grupo]}${g.parcial ? " (parcial)" : ""}`, num(g.total)]).getCell(2).numFmt = MOEDA;
  }
  for (const a of doc.precos.ajustesGerais) resumo.addRow([a.tipo === "desconto" ? "Desconto no total" : "Acréscimo no total", num(a.valor)]).getCell(2).numFmt = MOEDA;
  const total = resumo.addRow([doc.precos.parcial ? "Total geral (parcial)" : "Total geral", num(doc.precos.total)]);
  total.font = { bold: true };
  total.getCell(2).numFmt = MOEDA;
  if (verCusto) {
    resumo.addRow(["Custo total", num(doc.precos.custoTotal)]).getCell(2).numFmt = MOEDA;
    resumo.addRow(["Margem sobre a venda líquida (%)", num(doc.precos.margem)]);
  }
  resumo.getColumn(1).font = { bold: false };

  // Preços
  const precos = wb.addWorksheet("Preços");
  cabecalho(precos, [
    { titulo: "Grupo", largura: 12 },
    { titulo: "Código", largura: 16 },
    { titulo: "Descrição", largura: 48 },
    { titulo: "Qtd.", largura: 10, formato: QTD },
    { titulo: "Un.", largura: 6 },
    { titulo: "Unitário", largura: 14, formato: MOEDA },
    { titulo: "Total", largura: 14, formato: MOEDA },
    ...(verCusto ? [{ titulo: "Custo total", largura: 14, formato: MOEDA }] : []),
  ]);
  for (const l of doc.precos.linhas) {
    precos.addRow([GRUPO[l.grupo], l.codigo, l.descricao, l.quantidade, l.unidade, l.semPreco ? "sem preço" : num(l.unitario), num(l.total), ...(verCusto ? [num(l.custoTotal)] : [])]);
  }
  precos.addRow([]);
  for (const g of doc.precos.grupos) {
    precos.addRow(["", "", `Subtotal ${GRUPO[g.grupo]}`, null, null, null, num(g.subtotal)]);
    for (const a of g.ajustes) precos.addRow(["", "", `${a.tipo === "desconto" ? "Desconto" : "Acréscimo"}${a.percentual ? ` ${a.percentual}%` : ""}`, null, null, null, num(a.valor)]);
    for (const i of g.impostos) precos.addRow(["", "", `${i.nome} (${i.percentual}%)`, null, null, null, num(i.valor)]);
    precos.addRow(["", "", `Total ${GRUPO[g.grupo]}`, null, null, null, num(g.total)]).font = { bold: true };
  }
  for (const a of doc.precos.ajustesGerais) precos.addRow(["", "", a.tipo === "desconto" ? "Desconto no total" : "Acréscimo no total", null, null, null, num(a.valor)]);
  const tp = precos.addRow(["", "", doc.precos.parcial ? "Total geral (parcial)" : "Total geral", null, null, null, num(doc.precos.total)]);
  tp.font = { bold: true };

  // Lista totalizada
  const tot = wb.addWorksheet("Lista totalizada");
  cabecalho(tot, [
    { titulo: "Código", largura: 16 },
    { titulo: "Descrição", largura: 52 },
    { titulo: "Un.", largura: 6 },
    { titulo: "Qtd.", largura: 10, formato: QTD },
  ]);
  for (const l of doc.consolidado) tot.addRow([l.codigo, l.descricao, l.unidade, l.quantidade]);

  // Lista detalhada
  const det = wb.addWorksheet("Lista detalhada");
  cabecalho(det, [
    { titulo: "Origem", largura: 48 },
    { titulo: "Código", largura: 16 },
    { titulo: "Descrição", largura: 44 },
    { titulo: "Un.", largura: 6 },
    { titulo: "Qtd.", largura: 10, formato: QTD },
  ]);
  for (const l of doc.detalhada) det.addRow([l.origem, l.codigo, l.descricao, l.unidade, l.quantidade]);

  // I/O
  const io = wb.addWorksheet("Lista de I-O");
  cabecalho(io, [
    { titulo: "Painel", largura: 24 },
    { titulo: "Recurso", largura: 14 },
    { titulo: "Quantidade", largura: 12 },
  ]);
  for (const l of doc.io) io.addRow([l.painel, l.recurso, l.quantidade]);

  if (doc.tipo === "interno" && doc.pendencias.length) {
    const p = wb.addWorksheet("Pendências");
    cabecalho(p, [
      { titulo: "Gravidade", largura: 14 },
      { titulo: "Código", largura: 30 },
      { titulo: "Mensagem", largura: 90 },
    ]);
    for (const x of doc.pendencias) p.addRow([x.gravidade, x.codigo, x.mensagem]);
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}
