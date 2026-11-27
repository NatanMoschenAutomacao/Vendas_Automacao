"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { CADASTROS, INFO_DO_CADASTRO, funcaoDeControleSchema, tipoDePainelSchema, type Cadastro } from "./schema";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();
const cadastroSchema = z.enum(CADASTROS);

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) erros[String(i.path[0])] ??= i.message;
  return erros;
}

function ler(cadastro: Cadastro, form: FormData) {
  const t = (c: string) => String(form.get(c) ?? "");
  return cadastro === "tipo-de-painel"
    ? tipoDePainelSchema.safeParse({ nome: t("nome"), descricao: t("descricao"), isDemo: form.get("isDemo") === "on" })
    : funcaoDeControleSchema.safeParse({ codigo: t("codigo"), nome: t("nome"), descricao: t("descricao"), isDemo: form.get("isDemo") === "on" });
}

/* Os dois cadastros têm a mesma forma; este adaptador evita duplicar as ações. */
function tabela(cadastro: Cadastro, tx: Prisma.TransactionClient | typeof db = db) {
  return (cadastro === "tipo-de-painel" ? tx.tipoDePainel : tx.funcaoDeControle) as unknown as {
    create(a: { data: object }): Promise<{ id: string }>;
    update(a: { where: { id: string }; data: object }): Promise<object>;
    delete(a: { where: { id: string } }): Promise<object>;
    findUniqueOrThrow(a: { where: { id: string } }): Promise<{ id: string; ativo: boolean; ordem: number }>;
    findMany(a: object): Promise<{ id: string; ordem: number }[]>;
    aggregate(a: object): Promise<{ _max: { ordem: number | null } }>;
  };
}

const MENSAGEM_DUPLICADO: Record<Cadastro, Record<string, string>> = {
  "tipo-de-painel": { nome: "Já existe um tipo de painel com esse nome." },
  "funcao-de-controle": { codigo: "Já existe uma função com esse código." },
};

export async function salvarCadastro(cadastro: Cadastro, id: string | null, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  cadastroSchema.parse(cadastro);
  if (id) idSchema.parse(id);
  const d = ler(cadastro, form);
  if (!d.success) return { erros: errosDe(d.error.issues) };
  try {
    await db.$transaction(async (tx) => {
      const t = tabela(cadastro, tx);
      if (id) {
        const antes = await t.findUniqueOrThrow({ where: { id } });
        const depois = await t.update({ where: { id }, data: d.data });
        await auditar(tx, { usuarioId: u.id, acao: "editar", entidade: cadastro, entidadeId: id, antes, depois });
      } else {
        const ultima = await t.aggregate({ _max: { ordem: true } });
        const novo = await t.create({ data: { ...d.data, ordem: (ultima._max.ordem ?? -1) + 1 } });
        await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: cadastro, entidadeId: novo.id, depois: novo });
      }
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { erros: MENSAGEM_DUPLICADO[cadastro] };
    throw e;
  }
  revalidatePath(INFO_DO_CADASTRO[cadastro].caminho);
  if (id) redirect(INFO_DO_CADASTRO[cadastro].caminho);
  return { ok: true, mensagem: "Cadastro criado." };
}

export async function alternarAtivoCadastro(cadastro: Cadastro, id: string) {
  const u = await exigirPermissao(ACAO);
  cadastroSchema.parse(cadastro);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const t = tabela(cadastro, tx);
    const atual = await t.findUniqueOrThrow({ where: { id } });
    await t.update({ where: { id }, data: { ativo: !atual.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: atual.ativo ? "inativar" : "ativar", entidade: cadastro, entidadeId: id });
  });
  revalidatePath(INFO_DO_CADASTRO[cadastro].caminho);
}

export async function moverCadastro(cadastro: Cadastro, id: string, direcao: "cima" | "baixo") {
  const u = await exigirPermissao(ACAO);
  cadastroSchema.parse(cadastro);
  idSchema.parse(id);
  z.enum(["cima", "baixo"]).parse(direcao);
  const lista = await tabela(cadastro).findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  const pos = lista.findIndex((x) => x.id === id);
  const alvo = direcao === "cima" ? pos - 1 : pos + 1;
  if (pos < 0 || alvo < 0 || alvo >= lista.length) return;
  [lista[pos], lista[alvo]] = [lista[alvo]!, lista[pos]!];
  await db.$transaction(async (tx) => {
    const t = tabela(cadastro, tx);
    for (const [ordem, x] of lista.entries()) await t.update({ where: { id: x.id }, data: { ordem } });
    await auditar(tx, { usuarioId: u.id, acao: "reordenar", entidade: cadastro, entidadeId: id });
  });
  revalidatePath(INFO_DO_CADASTRO[cadastro].caminho);
}

/**
 * Excluir é seguro: orçamentos guardam só o id e, se ele sumir, viram
 * pendência ("escolha o tipo"/"escolha a função"), nunca erro.
 */
export async function excluirCadastro(cadastro: Cadastro, id: string) {
  const u = await exigirPermissao(ACAO);
  cadastroSchema.parse(cadastro);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const antes = await tabela(cadastro, tx).delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: cadastro, entidadeId: id, antes });
  });
  revalidatePath(INFO_DO_CADASTRO[cadastro].caminho);
}
