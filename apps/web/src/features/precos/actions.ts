"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { CHAVE_IMPOSTOS, CHAVE_LIMITE_DESCONTO, CHAVE_REGRA_COMERCIAL } from "./dados";
import { impostoSchema, limiteSchema, MODO_PARA_BANCO, precoSchema, regraComercialSchema, servicoSchema } from "./schema";

const ACAO = "precos:gerenciar" as const;
const idSchema = z.uuid();

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) erros[String(i.path[0])] ??= i.message;
  return erros;
}

function revalidarPrecos(itemId?: string) {
  revalidatePath("/admin/precos");
  revalidatePath("/admin/servicos", "layout");
  if (itemId) revalidatePath(`/admin/componentes/${itemId}`);
  revalidatePath("/orcamentos", "layout");
}

async function salvarConfiguracao(usuarioId: string, chave: string, valor: Prisma.InputJsonValue) {
  await db.$transaction(async (tx) => {
    const antes = await tx.configuracao.findUnique({ where: { chave } });
    await tx.configuracao.upsert({ where: { chave }, create: { chave, valor }, update: { valor } });
    await auditar(tx, { usuarioId, acao: "atualizar", entidade: "configuracao", entidadeId: chave, antes: antes?.valor ?? undefined, depois: valor });
  });
  revalidatePath("/admin/configuracoes");
  revalidarPrecos();
}

/* ───────────── Preços dos itens (histórico) ───────────── */

export async function criarPrecoDoItem(itemId: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(itemId);
  const t = (c: string) => String(form.get(c) ?? "");
  const d = precoSchema.safeParse({ modo: t("modo"), custo: t("custo"), venda: t("venda"), vigenteDesde: t("vigenteDesde"), observacao: t("observacao") });
  if (!d.success) return { erros: errosDe(d.error.issues), mensagem: "Revise os campos destacados." };
  const item = await db.itemDeCatalogo.findUnique({ where: { id: itemId }, select: { id: true, isDemo: true } });
  if (!item) return { mensagem: "Item não encontrado." };
  // A vigência começa no início do dia (horário de Brasília).
  const vigenteDesde = new Date(`${d.data.vigenteDesde}T00:00:00-03:00`);
  await db.$transaction(async (tx) => {
    const novo = await tx.precoDoItem.create({
      data: {
        itemId,
        modo: MODO_PARA_BANCO[d.data.modo],
        // Nunca os dois ao mesmo tempo: venda fixa ignora a regra; custo + regra não guarda venda.
        custo: d.data.custo,
        venda: d.data.modo === "venda_fixa" ? d.data.venda : null,
        vigenteDesde,
        observacao: d.data.observacao,
        atualizadoPor: u.nome,
        isDemo: item.isDemo,
      },
    });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "preco", entidadeId: novo.id, depois: novo });
  });
  revalidarPrecos(itemId);
  return { ok: true, mensagem: "Preço registrado." };
}

export async function excluirPrecoDoItem(id: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const antes = await db.precoDoItem.findUnique({ where: { id } });
  if (!antes) return { mensagem: "Preço não encontrado." };
  await db.$transaction(async (tx) => {
    await tx.precoDoItem.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "preco", entidadeId: id, antes });
  });
  revalidarPrecos(antes.itemId);
  return { ok: true };
}

/* ───────────── Configurações comerciais ───────────── */

export async function salvarRegraComercial(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const d = regraComercialSchema.safeParse({ tipo: String(form.get("tipo") ?? ""), percentual: String(form.get("percentual") ?? "") });
  if (!d.success) return { erros: errosDe(d.error.issues), mensagem: d.error.issues[0]?.message ?? "Dados inválidos." };
  await salvarConfiguracao(u.id, CHAVE_REGRA_COMERCIAL, { tipo: d.data.tipo, percentual: d.data.percentual });
  return { ok: true, mensagem: "Regra comercial salva." };
}

export async function salvarImpostos(json: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { mensagem: "Dados inválidos." };
  }
  const d = z.array(impostoSchema).max(30, "Cadastre no máximo 30 impostos.").safeParse(bruto);
  if (!d.success) return { mensagem: d.error.issues[0]?.message ?? "Dados inválidos." };
  await salvarConfiguracao(u.id, CHAVE_IMPOSTOS, d.data.map((i) => ({ ...i })));
  return { ok: true, mensagem: "Impostos salvos." };
}

export async function salvarLimiteDeDesconto(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const d = limiteSchema.safeParse({ percentual: String(form.get("percentual") ?? "") });
  if (!d.success) return { erros: errosDe(d.error.issues), mensagem: d.error.issues[0]?.message ?? "Dados inválidos." };
  await salvarConfiguracao(u.id, CHAVE_LIMITE_DESCONTO, { percentual: d.data.percentual });
  return { ok: true, mensagem: "Limite de desconto salvo." };
}

/* ───────────── Serviços ───────────── */

function lerServico(form: FormData) {
  const t = (c: string) => String(form.get(c) ?? "");
  return servicoSchema.safeParse({
    codigo: t("codigo"),
    descricao: t("descricao"),
    unidade: t("unidade"),
    fracionavel: form.get("fracionavel") === "on",
    valor: t("valor"),
    custo: t("custo"),
    isDemo: form.get("isDemo") === "on",
  });
}

export async function salvarServico(id: string | null, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  if (id) idSchema.parse(id);
  const d = lerServico(form);
  if (!d.success) return { erros: errosDe(d.error.issues), mensagem: "Revise os campos destacados." };
  let novoId: string | null = null;
  try {
    await db.$transaction(async (tx) => {
      if (id) {
        const antes = await tx.servico.findUniqueOrThrow({ where: { id } });
        const depois = await tx.servico.update({ where: { id }, data: d.data });
        await auditar(tx, { usuarioId: u.id, acao: "editar", entidade: "servico", entidadeId: id, antes, depois });
      } else {
        const novo = await tx.servico.create({ data: d.data });
        novoId = novo.id;
        await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "servico", entidadeId: novo.id, depois: novo });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { erros: { codigo: "Já existe um serviço com esse código." } };
    throw e;
  }
  revalidarPrecos();
  if (novoId) redirect(`/admin/servicos/${novoId}`);
  return { ok: true, mensagem: "Serviço salvo." };
}

export async function alternarAtivoServico(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const antes = await tx.servico.findUniqueOrThrow({ where: { id } });
    const depois = await tx.servico.update({ where: { id }, data: { ativo: !antes.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: depois.ativo ? "ativar" : "inativar", entidade: "servico", entidadeId: id, antes, depois });
  });
  revalidarPrecos();
}

export async function excluirServico(id: string, voltar?: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const emRegra = await db.regra.findFirst({ where: { efeitos: { string_contains: id } }, select: { codigo: true } });
  if (emRegra) return { mensagem: `O serviço é usado pela regra ${emRegra.codigo}. Inative-o ou altere a regra antes.` };
  await db.$transaction(async (tx) => {
    const antes = await tx.servico.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "servico", entidadeId: id, antes });
  });
  revalidarPrecos();
  if (voltar === "/admin/servicos") redirect(voltar);
  return { ok: true };
}
