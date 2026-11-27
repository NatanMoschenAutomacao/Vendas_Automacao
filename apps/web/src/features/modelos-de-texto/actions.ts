"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { validarCondicao, type DonoDaRegra } from "@zanatta/engine";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { carregarDono, donoDoBanco, donoParaBanco, lerDono } from "@/features/regras/dados";
import { variaveisDaRegra } from "@/features/regras/variaveis";
import { BASE_DO_DONO, modeloDeTextoSchema } from "./schema";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();
const CAMINHO = "/admin/modelos-de-texto";

export async function salvarModeloDeTexto(donoInformado: DonoDaRegra | null, id: string | null, json: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  if (id) idSchema.parse(id);
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { mensagem: "Dados inválidos." };
  }
  const d = modeloDeTextoSchema.safeParse(bruto);
  if (!d.success) {
    const erros: Record<string, string> = {};
    for (const i of d.error.issues) erros[String(i.path[0])] ??= i.message;
    return { erros, mensagem: "Revise os campos destacados." };
  }
  const anterior = id ? await db.modeloDeTexto.findUnique({ where: { id } }) : null;
  if (id && !anterior) return { mensagem: "Modelo de texto não encontrado." };
  const dono = anterior ? donoDoBanco(anterior) : lerDono(donoInformado?.tipo, donoInformado && "id" in donoInformado ? donoInformado.id : undefined);
  if (!dono) return { mensagem: "Dono inválido." };
  const ctx = await carregarDono(dono);
  if (!ctx) return { mensagem: "O dono do texto não existe mais." };
  if (d.data.condicao) {
    const e = validarCondicao(d.data.condicao, variaveisDaRegra(ctx.comuns, dono.tipo, BASE_DO_DONO[dono.tipo]));
    if (e.length) return { erros: { condicao: e[0]! }, mensagem: "Revise a condição." };
  }
  const dados = { ...d.data, condicao: d.data.condicao ?? Prisma.DbNull };
  let novoId: string | null = null;
  await db.$transaction(async (tx) => {
    if (anterior) {
      const depois = await tx.modeloDeTexto.update({ where: { id: anterior.id }, data: dados });
      await auditar(tx, { usuarioId: u.id, acao: "editar", entidade: "modelo_de_texto", entidadeId: anterior.id, antes: anterior, depois });
    } else {
      const novo = await tx.modeloDeTexto.create({ data: { ...dados, ...donoParaBanco(dono) } });
      novoId = novo.id;
      await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "modelo_de_texto", entidadeId: novo.id, depois: novo });
    }
  });
  revalidatePath(CAMINHO, "layout");
  if (novoId) redirect(`${CAMINHO}/${novoId}?criado=1`);
  return { ok: true, mensagem: "Modelo de texto salvo." };
}

export async function alternarAtivoModeloDeTexto(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const antes = await tx.modeloDeTexto.findUniqueOrThrow({ where: { id } });
    const depois = await tx.modeloDeTexto.update({ where: { id }, data: { ativo: !antes.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: depois.ativo ? "ativar" : "inativar", entidade: "modelo_de_texto", entidadeId: id, antes, depois });
  });
  revalidatePath(CAMINHO, "layout");
}

export async function excluirModeloDeTexto(id: string, voltar?: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const antes = await tx.modeloDeTexto.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "modelo_de_texto", entidadeId: id, antes });
  });
  revalidatePath(CAMINHO, "layout");
  if (voltar === CAMINHO) redirect(CAMINHO);
  return { ok: true };
}
