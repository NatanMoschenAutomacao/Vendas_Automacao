import "server-only";
import { z } from "zod";
import {
  precoUnitarioDeVenda,
  type Imposto,
  type PrecoNoSnapshot,
  type RegraComercial,
  type ServicoNoSnapshot,
  type SnapshotDaBiblioteca,
} from "@zanatta/engine";
import { db } from "@/server/db";
import { impostoSchema, limiteSchema, MODO_DO_BANCO, regraComercialSchema, type LimiteDeDesconto } from "./schema";

export const CHAVE_REGRA_COMERCIAL = "regra_comercial_padrao";
export const CHAVE_IMPOSTOS = "impostos";
export const CHAVE_LIMITE_DESCONTO = "limite_desconto_vendedor";

const decimal = (v: { toString(): string } | null) => (v === null ? null : v.toString());

export async function lerRegraComercial(): Promise<RegraComercial | null> {
  const c = await db.configuracao.findUnique({ where: { chave: CHAVE_REGRA_COMERCIAL } });
  const r = regraComercialSchema.safeParse(c?.valor);
  return r.success ? r.data : null;
}

export async function lerImpostos(): Promise<Imposto[]> {
  const c = await db.configuracao.findUnique({ where: { chave: CHAVE_IMPOSTOS } });
  const r = z.array(impostoSchema).safeParse(c?.valor);
  return r.success ? r.data : [];
}

/** Sem limite cadastrado, o vendedor não aplica desconto (0%). */
export async function lerLimiteDeDesconto(): Promise<LimiteDeDesconto> {
  const c = await db.configuracao.findUnique({ where: { chave: CHAVE_LIMITE_DESCONTO } });
  const r = limiteSchema.safeParse(c?.valor);
  return r.success ? r.data : { percentual: "0" };
}

/** Preço vigente de cada item: o de maior "vigenteDesde" que já começou. */
export async function carregarPrecosVigentes(agora = new Date()): Promise<Record<string, PrecoNoSnapshot>> {
  const precos = await db.precoDoItem.findMany({
    where: { vigenteDesde: { lte: agora } },
    orderBy: [{ itemId: "asc" }, { vigenteDesde: "desc" }, { criadoEm: "desc" }],
    distinct: ["itemId"],
  });
  return Object.fromEntries(precos.map((p) => [p.itemId, { modo: MODO_DO_BANCO[p.modo], custo: decimal(p.custo), venda: decimal(p.venda) }]));
}

export async function carregarServicos(): Promise<Record<string, ServicoNoSnapshot>> {
  const servicos = await db.servico.findMany({ orderBy: { codigo: "asc" } });
  return Object.fromEntries(
    servicos.map((s) => [
      s.id,
      { id: s.id, codigo: s.codigo, descricao: s.descricao, unidade: s.unidade, fracionavel: s.fracionavel, valor: decimal(s.valor), custo: decimal(s.custo), ativo: s.ativo },
    ]),
  );
}

/** Parte comercial do snapshot do motor, completa (com custos). */
export async function carregarComercialDoSnapshot(): Promise<Pick<SnapshotDaBiblioteca, "precos" | "servicos" | "regraComercial" | "impostos">> {
  const [precos, servicos, regraComercial, impostos] = await Promise.all([carregarPrecosVigentes(), carregarServicos(), lerRegraComercial(), lerImpostos()]);
  return { precos, servicos, regraComercial, impostos };
}

/**
 * Remove custos e a regra comercial para quem não pode ver custo (§33, §43).
 * Itens em "custo + regra" viram venda fixa com o preço já calculado, então
 * o navegador do vendedor nunca recebe custo nem margem.
 */
export function ocultarCustos(s: SnapshotDaBiblioteca): SnapshotDaBiblioteca {
  const precos: Record<string, PrecoNoSnapshot> = {};
  for (const [id, p] of Object.entries(s.precos ?? {})) {
    const venda = precoUnitarioDeVenda(p, s.regraComercial);
    precos[id] = { modo: "venda_fixa", custo: null, venda: venda ? venda.toFixed(2) : null };
  }
  const servicos: Record<string, ServicoNoSnapshot> = {};
  for (const [id, sv] of Object.entries(s.servicos ?? {})) servicos[id] = { ...sv, custo: null };
  return { ...s, precos, servicos, regraComercial: null, custosOcultos: true };
}
