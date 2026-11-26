"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { categoriaSchema } from "./schema";
import { mover, paiValido } from "./arvore";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) erros[String(i.path[0])] ??= i.message;
  return erros;
}

function lerForm(form: FormData) {
  return categoriaSchema.safeParse({
    nome: form.get("nome") ?? "",
    descricao: form.get("descricao") ?? "",
    paiId: form.get("paiId") ?? "",
  });
}

async function nomeDuplicado(nome: string, paiId: string | null, ignorarId?: string) {
  const existente = await db.categoria.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" }, paiId, NOT: ignorarId ? { id: ignorarId } : undefined },
    select: { id: true },
  });
  return Boolean(existente);
}

export async function criarCategoria(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const dados = lerForm(form);
  if (!dados.success) return { erros: errosDe(dados.error.issues) };
  if (await nomeDuplicado(dados.data.nome, dados.data.paiId)) {
    return { erros: { nome: "Já existe uma categoria com esse nome neste nível." } };
  }
  const ultima = await db.categoria.aggregate({ where: { paiId: dados.data.paiId }, _max: { ordem: true } });
  await db.$transaction(async (tx) => {
    const c = await tx.categoria.create({ data: { ...dados.data, ordem: (ultima._max.ordem ?? -1) + 1 } });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "categoria", entidadeId: c.id, depois: c });
  });
  revalidatePath("/admin/categorias");
  return { ok: true, mensagem: `Categoria "${dados.data.nome}" criada.` };
}

export async function atualizarCategoria(
  id: string,
  _: EstadoDoFormulario,
  form: FormData,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const dados = lerForm(form);
  if (!dados.success) return { erros: errosDe(dados.error.issues) };

  const todas = await db.categoria.findMany({ select: { id: true, paiId: true, ordem: true, nome: true } });
  if (!paiValido(todas, id, dados.data.paiId)) {
    return { erros: { paiId: "Uma categoria não pode ficar dentro dela mesma ou de uma subcategoria sua." } };
  }
  if (await nomeDuplicado(dados.data.nome, dados.data.paiId, id)) {
    return { erros: { nome: "Já existe uma categoria com esse nome neste nível." } };
  }
  await db.$transaction(async (tx) => {
    const antes = await tx.categoria.findUniqueOrThrow({ where: { id } });
    const mudouPai = antes.paiId !== dados.data.paiId;
    const ordem = mudouPai
      ? ((await tx.categoria.aggregate({ where: { paiId: dados.data.paiId }, _max: { ordem: true } }))._max.ordem ??
          -1) + 1
      : antes.ordem;
    const depois = await tx.categoria.update({ where: { id }, data: { ...dados.data, ordem } });
    await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "categoria", entidadeId: id, antes, depois });
  });
  revalidatePath("/admin/categorias");
  redirect("/admin/categorias");
}

export async function alternarAtivoCategoria(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const antes = await tx.categoria.findUniqueOrThrow({ where: { id } });
    const depois = await tx.categoria.update({ where: { id }, data: { ativo: !antes.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: "alternar-ativo", entidade: "categoria", entidadeId: id, antes, depois });
  });
  revalidatePath("/admin/categorias");
}

export async function moverCategoria(id: string, direcao: "cima" | "baixo") {
  await exigirPermissao(ACAO);
  idSchema.parse(id);
  z.enum(["cima", "baixo"]).parse(direcao);
  const atual = await db.categoria.findUniqueOrThrow({ where: { id } });
  const irmas = await db.categoria.findMany({
    where: { paiId: atual.paiId },
    select: { id: true, paiId: true, ordem: true, nome: true },
  });
  const updates = mover(irmas, id, direcao);
  await db.$transaction(updates.map((x) => db.categoria.update({ where: { id: x.id }, data: { ordem: x.ordem } })));
  revalidatePath("/admin/categorias");
}

export async function duplicarCategoria(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const original = await db.categoria.findUniqueOrThrow({ where: { id } });
  let nome = `${original.nome} (cópia)`;
  for (let n = 2; await nomeDuplicado(nome, original.paiId); n++) nome = `${original.nome} (cópia ${n})`;
  const ultima = await db.categoria.aggregate({ where: { paiId: original.paiId }, _max: { ordem: true } });
  await db.$transaction(async (tx) => {
    const c = await tx.categoria.create({
      data: {
        nome,
        descricao: original.descricao,
        paiId: original.paiId,
        ativo: original.ativo,
        isDemo: original.isDemo,
        ordem: (ultima._max.ordem ?? -1) + 1,
      },
    });
    await auditar(tx, { usuarioId: u.id, acao: "duplicar", entidade: "categoria", entidadeId: c.id, antes: original, depois: c });
  });
  revalidatePath("/admin/categorias");
}

export async function excluirCategoria(id: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const filhas = await db.categoria.count({ where: { paiId: id } });
  if (filhas > 0) {
    return { mensagem: "Esta categoria tem subcategorias. Mova ou exclua as subcategorias primeiro." };
  }
  await db.$transaction(async (tx) => {
    const antes = await tx.categoria.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "categoria", entidadeId: id, antes });
  });
  revalidatePath("/admin/categorias");
  return { ok: true };
}
