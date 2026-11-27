"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { interpretarPlanilha } from "./importacao";
import { itemSchema } from "./schema";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();
const CAMINHO = "/admin/componentes";

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) erros[String(i.path[0])] ??= i.message;
  return erros;
}

function lerItem(form: FormData) {
  const t = (c: string) => String(form.get(c) ?? "");
  return itemSchema.safeParse({
    codigo: t("codigo"),
    descricao: t("descricao"),
    unidade: t("unidade"),
    fracionavel: form.get("fracionavel") === "on",
    codigoFabricante: t("codigoFabricante"),
    fabricante: t("fabricante"),
    modelo: t("modelo"),
    fornecedor: t("fornecedor"),
    categoriaId: t("categoriaId"),
    isDemo: form.get("isDemo") === "on",
  });
}

export async function salvarItem(id: string | null, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  if (id) idSchema.parse(id);
  const d = lerItem(form);
  if (!d.success) return { erros: errosDe(d.error.issues), mensagem: "Revise os campos destacados." };
  try {
    await db.$transaction(async (tx) => {
      if (id) {
        const antes = await tx.itemDeCatalogo.findUniqueOrThrow({ where: { id } });
        const depois = await tx.itemDeCatalogo.update({ where: { id }, data: d.data });
        await auditar(tx, { usuarioId: u.id, acao: "editar", entidade: "item", entidadeId: id, antes, depois });
      } else {
        const novo = await tx.itemDeCatalogo.create({ data: d.data });
        await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "item", entidadeId: novo.id, depois: novo });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { erros: { codigo: "Já existe um item com esse código." } };
    throw e;
  }
  revalidatePath(CAMINHO);
  if (id) return { ok: true, mensagem: "Item salvo." };
  return { ok: true, mensagem: `Item ${d.data.codigo} criado.` };
}

export async function alternarAtivoItem(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const i = await tx.itemDeCatalogo.findUniqueOrThrow({ where: { id } });
    await tx.itemDeCatalogo.update({ where: { id }, data: { ativo: !i.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: i.ativo ? "inativar" : "ativar", entidade: "item", entidadeId: id });
  });
  revalidatePath(CAMINHO);
}

/** Itens usados em regras ou modelos não são excluídos: inative-os. */
export async function excluirItem(id: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const [modelos, regras, controladores] = await Promise.all([
    db.modelo.count({ where: { itemId: id } }),
    db.regra.count({ where: { efeitos: { string_contains: id } } }),
    db.controlador.count({ where: { itemId: id } }),
  ]);
  if (modelos + regras + controladores > 0)
    return { ok: false, mensagem: "O item é usado por modelos, regras ou como controlador. Inative-o em vez de excluir." };
  await db.$transaction(async (tx) => {
    const antes = await tx.itemDeCatalogo.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "item", entidadeId: id, antes });
  });
  revalidatePath(CAMINHO);
  redirect(CAMINHO);
}

export async function criarCategoriaDeComponente(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const nome = z.string().trim().min(2, "Informe o nome.").max(80).safeParse(String(form.get("nome") ?? ""));
  if (!nome.success) return { erros: { nome: nome.error.issues[0]!.message } };
  try {
    await db.$transaction(async (tx) => {
      const c = await tx.categoriaDeComponente.create({ data: { nome: nome.data } });
      await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "categoria-de-componente", entidadeId: c.id, depois: c });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { erros: { nome: "Já existe essa categoria." } };
    throw e;
  }
  revalidatePath(CAMINHO);
  return { ok: true, mensagem: "Categoria criada." };
}

export interface ResultadoDaImportacao extends EstadoDoFormulario {
  resumo?: { novos: number; atualizados: number; erros: { linha: number; erro: string }[]; simulado: boolean };
}

/**
 * Importa itens colados de uma planilha. "Simular" só mostra o que mudaria;
 * "Importar" cria os novos e atualiza os existentes pelo código.
 */
export async function importarItens(_: ResultadoDaImportacao, form: FormData): Promise<ResultadoDaImportacao> {
  const u = await exigirPermissao(ACAO);
  const texto = String(form.get("planilha") ?? "");
  if (texto.length > 2_000_000) return { mensagem: "Planilha grande demais." };
  const simulado = form.get("modo") !== "importar";
  const isDemo = form.get("isDemo") === "on";
  const { linhas, erroGeral } = interpretarPlanilha(texto);
  if (erroGeral) return { mensagem: erroGeral };
  const validas = linhas.filter((l) => l.dados);
  const erros = linhas.filter((l) => l.erro).map((l) => ({ linha: l.linha, erro: l.erro! }));
  const existentes = new Set(
    (await db.itemDeCatalogo.findMany({ where: { codigo: { in: validas.map((l) => l.dados!.codigo) } }, select: { codigo: true } })).map((i) => i.codigo),
  );
  const resumo = { novos: validas.filter((l) => !existentes.has(l.dados!.codigo)).length, atualizados: validas.filter((l) => existentes.has(l.dados!.codigo)).length, erros, simulado };
  if (simulado || validas.length === 0) return { resumo };

  await db.$transaction(
    async (tx) => {
      const categorias = new Map((await tx.categoriaDeComponente.findMany()).map((c) => [c.nome.toLowerCase(), c.id]));
      for (const l of validas) {
        const { categoria, ...dados } = l.dados!;
        let categoriaId: string | null = null;
        if (categoria) {
          categoriaId = categorias.get(categoria.toLowerCase()) ?? null;
          if (!categoriaId) {
            categoriaId = (await tx.categoriaDeComponente.create({ data: { nome: categoria } })).id;
            categorias.set(categoria.toLowerCase(), categoriaId);
          }
        }
        await tx.itemDeCatalogo.upsert({
          where: { codigo: dados.codigo },
          create: { ...dados, categoriaId, isDemo },
          update: { ...dados, ...(categoria ? { categoriaId } : {}) },
        });
      }
      await auditar(tx, { usuarioId: u.id, acao: "importar", entidade: "item", depois: { novos: resumo.novos, atualizados: resumo.atualizados } });
    },
    { timeout: 60_000 },
  );
  revalidatePath(CAMINHO);
  return { ok: true, mensagem: `Importação concluída: ${resumo.novos} novo(s), ${resumo.atualizados} atualizado(s).`, resumo };
}
