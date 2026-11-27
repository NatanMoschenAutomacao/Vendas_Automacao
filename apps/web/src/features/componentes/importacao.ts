/**
 * Leitura de planilha para importar itens do catálogo. Aceita o texto
 * copiado do Excel (colunas separadas por tabulação) ou um CSV com ";" ou ",".
 * Funções puras, testadas em importacao.test.ts.
 */
import type { ModoDePreco } from "@zanatta/engine";
import { normalizarDecimal } from "@/features/precos/schema";
import { itemSchema, type DadosDoItem } from "./schema";

export const COLUNAS = ["codigo", "descricao", "unidade", "fabricante", "codigo_fabricante", "modelo", "fornecedor", "categoria", "fracionavel", "grupo", "custo", "venda", "modo"] as const;

const SINONIMOS: Record<string, (typeof COLUNAS)[number]> = {
  codigo: "codigo",
  "código": "codigo",
  "codigo interno": "codigo",
  descricao: "descricao",
  "descrição": "descricao",
  unidade: "unidade",
  un: "unidade",
  fabricante: "fabricante",
  codigo_fabricante: "codigo_fabricante",
  "codigo do fabricante": "codigo_fabricante",
  "código do fabricante": "codigo_fabricante",
  modelo: "modelo",
  fornecedor: "fornecedor",
  categoria: "categoria",
  fracionavel: "fracionavel",
  "fracionável": "fracionavel",
  grupo: "grupo",
  "grupo comercial": "grupo",
  custo: "custo",
  venda: "venda",
  "preço de venda": "venda",
  "preco de venda": "venda",
  modo: "modo",
  "modo de preço": "modo",
  "modo de preco": "modo",
};

/** Divide o texto em linhas e células, respeitando aspas. */
export function lerTabela(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const primeira = limpo.split("\n", 1)[0] ?? "";
  const sep = primeira.includes("\t") ? "\t" : primeira.split(";").length >= primeira.split(",").length ? ";" : ",";
  const linhas: string[][] = [];
  let celula = "";
  let linha: string[] = [];
  let aspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i]!;
    if (aspas) {
      if (ch === '"' && limpo[i + 1] === '"') {
        celula += '"';
        i++;
      } else if (ch === '"') aspas = false;
      else celula += ch;
    } else if (ch === '"' && celula === "") aspas = true;
    else if (ch === sep) {
      linha.push(celula);
      celula = "";
    } else if (ch === "\n") {
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
    } else celula += ch;
  }
  if (celula !== "" || linha.length) {
    linha.push(celula);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ""));
}

export interface LinhaImportada {
  linha: number;
  dados?: Omit<DadosDoItem, "categoriaId" | "isDemo"> & { categoria: string | null };
  /** Preço informado na planilha (novo registro no histórico). */
  preco?: { modo: ModoDePreco; custo: string | null; venda: string | null };
  erro?: string;
}

const SIM = new Set(["sim", "s", "1", "true", "verdadeiro", "x"]);

/** Converte a tabela em itens validados. A primeira linha deve ter os nomes das colunas. */
export function interpretarPlanilha(texto: string): { linhas: LinhaImportada[]; erroGeral?: string } {
  const tabela = lerTabela(texto);
  if (tabela.length < 2) return { linhas: [], erroGeral: "Cole a planilha com a linha de títulos e ao menos um item." };
  const cabecalho = tabela[0]!.map((c) => SINONIMOS[c.trim().toLowerCase()] ?? null);
  for (const obrigatoria of ["codigo", "descricao", "unidade"] as const) {
    if (!cabecalho.includes(obrigatoria)) return { linhas: [], erroGeral: `Falta a coluna "${obrigatoria}".` };
  }
  if (tabela.length - 1 > 2000) return { linhas: [], erroGeral: "Importe no máximo 2000 itens por vez." };
  const vistos = new Set<string>();
  const linhas = tabela.slice(1).map((cels, n): LinhaImportada => {
    const v = (col: (typeof COLUNAS)[number]) => {
      const i = cabecalho.indexOf(col);
      return i >= 0 ? (cels[i] ?? "").trim() : "";
    };
    const r = itemSchema.safeParse({
      codigo: v("codigo"),
      descricao: v("descricao"),
      unidade: v("unidade"),
      fracionavel: SIM.has(v("fracionavel").toLowerCase()),
      grupoComercial: v("grupo").toLowerCase() === "software" ? "SOFTWARE" : "MATERIAL",
      codigoFabricante: v("codigo_fabricante"),
      fabricante: v("fabricante"),
      modelo: v("modelo"),
      fornecedor: v("fornecedor"),
      categoriaId: "",
      isDemo: false,
    });
    const linha = n + 2;
    if (!r.success) {
      const i = r.error.issues[0]!;
      return { linha, erro: `${String(i.path[0])}: ${i.message}` };
    }
    if (vistos.has(r.data.codigo)) return { linha, erro: `código ${r.data.codigo} repetido na planilha.` };
    vistos.add(r.data.codigo);
    const custo = normalizarDecimal(v("custo"));
    const venda = normalizarDecimal(v("venda"));
    if (custo === "NaN" || venda === "NaN") return { linha, erro: "custo ou venda: use um número, ex.: 1234,56." };
    const modoTexto = v("modo").toLowerCase();
    let preco: LinhaImportada["preco"];
    if (custo !== null || venda !== null || modoTexto) {
      const modo: ModoDePreco = modoTexto ? (modoTexto.includes("custo") ? "custo_regra" : "venda_fixa") : venda !== null ? "venda_fixa" : "custo_regra";
      if (modo === "venda_fixa" && venda === null) return { linha, erro: "venda fixa exige a coluna venda." };
      if (modo === "custo_regra" && custo === null) return { linha, erro: "custo + regra exige a coluna custo." };
      preco = { modo, custo, venda: modo === "venda_fixa" ? venda : null };
    }
    const dados = { ...r.data } as Partial<typeof r.data>;
    delete dados.categoriaId;
    delete dados.isDemo;
    return { linha, dados: { ...(dados as Omit<typeof r.data, "categoriaId" | "isDemo">), categoria: v("categoria").slice(0, 80) || null }, ...(preco ? { preco } : {}) };
  });
  return { linhas };
}
