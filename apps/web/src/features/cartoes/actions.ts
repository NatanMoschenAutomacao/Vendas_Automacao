"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { inteiroOpcional, recursosSchema } from "@/features/controladores/schema";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();
const CAMINHO = "/admin/cartoes";
const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => v || null);

const cartaoSchema = z.object({
  barramento: texto(60),
  consumo: inteiroOpcional(1_000_000, "Consumo: número inteiro em mA."),
  tipoDeSinal: texto(120),
  observacoes: texto(2000),
  isDemo: z.boolean(),
});

function revalidar(id?: string) {
  revalidatePath(CAMINHO);
  revalidatePath("/admin/controladores", "layout");
  if (id) revalidatePath(`${CAMINHO}/${id}`);
}

export async function criarCartao(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const itemId = idSchema.safeParse(String(form.get("itemId") ?? ""));
  if (!itemId.success) return { erros: { itemId: "Escolha o item do catálogo." } };
  const item = await db.itemDeCatalogo.findUnique({
    where: { id: itemId.data },
    select: { id: true, isDemo: true, cartao: { select: { id: true } }, controlador: { select: { id: true } } },
  });
  if (!item) return { erros: { itemId: "Item não encontrado." } };
  if (item.cartao || item.controlador) return { erros: { itemId: "Este item já é um cartão ou controlador." } };
  const c = await db.$transaction(async (tx) => {
    const novo = await tx.cartaoDeExpansao.create({ data: { itemId: item.id, isDemo: item.isDemo } });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "cartao", entidadeId: novo.id, depois: novo });
    return novo;
  });
  revalidar();
  redirect(`${CAMINHO}/${c.id}`);
}

export async function salvarCartao(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const d = cartaoSchema.safeParse({
    barramento: String(form.get("barramento") ?? ""),
    consumo: String(form.get("consumo") ?? ""),
    tipoDeSinal: String(form.get("tipoDeSinal") ?? ""),
    observacoes: String(form.get("observacoes") ?? ""),
    isDemo: form.get("isDemo") === "on",
  });
  if (!d.success) {
    const erros: Record<string, string> = {};
    for (const i of d.error.issues) erros[String(i.path[0])] ??= i.message;
    return { erros, mensagem: "Revise os campos destacados." };
  }
  await db.$transaction(async (tx) => {
    const antes = await tx.cartaoDeExpansao.findUniqueOrThrow({ where: { id } });
    const depois = await tx.cartaoDeExpansao.update({ where: { id }, data: d.data });
    await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "cartao", entidadeId: id, antes, depois });
  });
  revalidar(id);
  return { ok: true, mensagem: "Cartão salvo." };
}

export async function salvarRecursosDoCartao(id: string, json: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { mensagem: "Dados inválidos." };
  }
  const d = recursosSchema.safeParse(bruto);
  if (!d.success) return { mensagem: d.error.issues[0]?.message ?? "Dados inválidos." };
  if ((await db.tipoDeRecurso.count({ where: { id: { in: Object.keys(d.data) } } })) !== Object.keys(d.data).length)
    return { mensagem: "Tipo de recurso não encontrado." };
  await db.$transaction(async (tx) => {
    await tx.recursoDoCartao.deleteMany({ where: { cartaoId: id } });
    const linhas = Object.entries(d.data)
      .filter(([, q]) => q > 0)
      .map(([tipoRecursoId, quantidade]) => ({ cartaoId: id, tipoRecursoId, quantidade }));
    if (linhas.length) await tx.recursoDoCartao.createMany({ data: linhas });
    await auditar(tx, { usuarioId: u.id, acao: "editar-recursos", entidade: "cartao", entidadeId: id, depois: d.data });
  });
  revalidar(id);
  return { ok: true, mensagem: "Pontos do cartão salvos." };
}

export async function salvarControladoresDoCartao(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const ids = z.array(z.uuid()).max(500).safeParse(form.getAll("controladores").map(String));
  if (!ids.success) return { mensagem: "Seleção inválida." };
  if ((await db.controlador.count({ where: { id: { in: ids.data } } })) !== ids.data.length) return { mensagem: "Controlador não encontrado." };
  await db.$transaction(async (tx) => {
    await tx.cartaoDeExpansao.update({ where: { id }, data: { controladores: { set: ids.data.map((c) => ({ id: c })) } } });
    await auditar(tx, { usuarioId: u.id, acao: "editar-compatibilidade", entidade: "cartao", entidadeId: id, depois: ids.data });
  });
  revalidar(id);
  return { ok: true, mensagem: `${ids.data.length} controlador(es) compatível(is).` };
}

export async function alternarAtivoCartao(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const c = await tx.cartaoDeExpansao.findUniqueOrThrow({ where: { id } });
    await tx.cartaoDeExpansao.update({ where: { id }, data: { ativo: !c.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: c.ativo ? "inativar" : "ativar", entidade: "cartao", entidadeId: id });
  });
  revalidar(id);
}

export async function excluirCartao(id: string, voltar?: boolean) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const antes = await tx.cartaoDeExpansao.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "cartao", entidadeId: id, antes });
  });
  revalidar();
  if (voltar) redirect(CAMINHO);
  return { ok: true };
}
