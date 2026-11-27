"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { CONFIGURACAO_VAZIA, configuracaoSchema, dadosBasicosSchema } from "./schema";
import { filtroDeAcesso } from "./queries";

const idSchema = z.uuid();

function lerDados(form: FormData) {
  const t = (c: string) => String(form.get(c) ?? "");
  return dadosBasicosSchema.safeParse({
    cliente: t("cliente"),
    empresa: t("empresa"),
    projeto: t("projeto"),
    cidade: t("cidade"),
    uf: t("uf"),
    observacoes: t("observacoes"),
  });
}

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) erros[String(i.path[0])] ??= i.message;
  return erros;
}

/** Próximo número do ano: 2026-0001, 2026-0002… */
async function proximoNumero(tx: Prisma.TransactionClient, ano: number) {
  const ultimo = await tx.orcamento.findFirst({
    where: { numero: { startsWith: `${ano}-` } },
    orderBy: { numero: "desc" },
    select: { numero: true },
  });
  const seq = ultimo ? Number(ultimo.numero.slice(5)) + 1 : 1;
  return `${ano}-${String(seq).padStart(4, "0")}`;
}

export async function criarOrcamento(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao("orcamento:criar");
  const dados = lerDados(form);
  if (!dados.success) return { erros: errosDe(dados.error.issues), mensagem: "Revise os campos destacados." };
  const ano = new Date().getFullYear();
  let id: string | null = null;
  // Dois vendedores criando ao mesmo tempo podem disputar o mesmo número: tenta de novo.
  for (let tentativa = 0; tentativa < 3 && !id; tentativa++) {
    try {
      id = await db.$transaction(async (tx) => {
        const o = await tx.orcamento.create({
          data: { ...dados.data, numero: await proximoNumero(tx, ano), vendedorId: u.id },
        });
        await tx.revisao.create({ data: { orcamentoId: o.id, numero: 1, configuracao: CONFIGURACAO_VAZIA } });
        await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "orcamento", entidadeId: o.id, depois: o });
        return o.id;
      });
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    }
  }
  if (!id) return { mensagem: "Não foi possível numerar o orçamento. Tente de novo." };
  revalidatePath("/");
  redirect(`/orcamentos/${id}`);
}

async function orcamentoEditavel(id: string, u: Awaited<ReturnType<typeof exigirPermissao>>) {
  idSchema.parse(id);
  const o = await db.orcamento.findFirst({ where: { id, ...filtroDeAcesso(u) } });
  if (!o) throw new Error("Orçamento não encontrado.");
  return o;
}

export async function salvarDadosBasicos(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao("orcamento:criar");
  const antes = await orcamentoEditavel(id, u);
  if (antes.status !== "RASCUNHO") return { mensagem: "Só é possível alterar orçamentos em rascunho." };
  const dados = lerDados(form);
  if (!dados.success) return { erros: errosDe(dados.error.issues), mensagem: "Revise os campos destacados." };
  await db.$transaction(async (tx) => {
    const depois = await tx.orcamento.update({ where: { id }, data: dados.data });
    await auditar(tx, { usuarioId: u.id, acao: "editar", entidade: "orcamento", entidadeId: id, antes, depois });
  });
  revalidatePath("/");
  revalidatePath(`/orcamentos/${id}`, "layout");
  return { ok: true, mensagem: "Dados salvos." };
}

export type ResultadoDoRascunho = { ok: true; salvoEm: string } | { ok: false; erro: string };

/**
 * Salvamento automático do rascunho. Grava só as escolhas do vendedor
 * (a configuração); materiais e valores são sempre recalculados.
 */
export async function salvarRascunho(id: string, json: string): Promise<ResultadoDoRascunho> {
  const u = await exigirPermissao("orcamento:criar");
  const o = await orcamentoEditavel(id, u).catch(() => null);
  if (!o) return { ok: false, erro: "Orçamento não encontrado." };
  if (o.status !== "RASCUNHO") return { ok: false, erro: "O orçamento não está mais em rascunho." };
  if (json.length > 2_000_000) return { ok: false, erro: "Configuração grande demais." };
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { ok: false, erro: "Configuração inválida." };
  }
  const config = configuracaoSchema.safeParse(bruto);
  if (!config.success) return { ok: false, erro: config.error.issues[0]?.message ?? "Configuração inválida." };
  const r = await db.$transaction(async (tx) => {
    const rev = await tx.revisao.findFirst({ where: { orcamentoId: id }, orderBy: { numero: "desc" } });
    const salva = rev
      ? await tx.revisao.update({ where: { id: rev.id }, data: { configuracao: config.data } })
      : await tx.revisao.create({ data: { orcamentoId: id, numero: 1, configuracao: config.data } });
    await tx.orcamento.update({ where: { id }, data: { atualizadoEm: new Date() } });
    return salva;
  });
  return { ok: true, salvoEm: r.salvoEm.toISOString() };
}

export async function excluirOrcamento(id: string) {
  const u = await exigirPermissao("orcamento:criar");
  const antes = await orcamentoEditavel(id, u);
  if (antes.status !== "RASCUNHO") throw new Error("Só é possível excluir orçamentos em rascunho.");
  await db.$transaction(async (tx) => {
    await tx.orcamento.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "orcamento", entidadeId: id, antes });
  });
  revalidatePath("/");
}
