"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { gerarHashDeSenha } from "@/server/auth/password";
import { senhaSchema } from "@/server/auth/regras-de-senha";
import { PERFIS } from "@/server/auth/permissions";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";

const ACAO = "usuarios:gerenciar" as const;

const novoUsuarioSchema = z.object({
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,40}$/, "Use de 3 a 40 letras minúsculas, números, ponto, hífen ou sublinhado."),
  nome: z.string().trim().min(2, "Informe o nome.").max(80),
  perfil: z.enum(PERFIS),
  senha: senhaSchema,
});

const semSegredo = <T extends { senhaHash?: string }>(u: T) => ({ ...u, senhaHash: undefined });

export async function criarUsuario(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const eu = await exigirPermissao(ACAO);
  const dados = novoUsuarioSchema.safeParse(Object.fromEntries(form));
  if (!dados.success) {
    const erros: Record<string, string> = {};
    for (const i of dados.error.issues) erros[String(i.path[0])] ??= i.message;
    return { erros };
  }
  if (await db.usuario.findUnique({ where: { usuario: dados.data.usuario } })) {
    return { erros: { usuario: "Este usuário já existe." } };
  }
  const { senha, ...resto } = dados.data;
  await db.$transaction(async (tx) => {
    const u = await tx.usuario.create({
      data: { ...resto, senhaHash: await gerarHashDeSenha(senha), trocarSenha: true },
    });
    await auditar(tx, { usuarioId: eu.id, acao: "criar", entidade: "usuario", entidadeId: u.id, depois: semSegredo(u) });
  });
  revalidatePath("/admin/usuarios");
  return { ok: true, mensagem: `Usuário ${dados.data.usuario} criado. Ele trocará a senha no primeiro acesso.` };
}

async function contarAdminsAtivos() {
  return db.usuario.count({ where: { perfil: "ADMIN_TECNICO", ativo: true } });
}

export async function alternarAtivoUsuario(id: string): Promise<EstadoDoFormulario> {
  const eu = await exigirPermissao(ACAO);
  z.uuid().parse(id);
  if (id === eu.id) return { mensagem: "Você não pode desativar o próprio usuário." };
  const antes = await db.usuario.findUniqueOrThrow({ where: { id } });
  if (antes.ativo && antes.perfil === "ADMIN_TECNICO" && (await contarAdminsAtivos()) <= 1) {
    return { mensagem: "É preciso manter pelo menos um administrador técnico ativo." };
  }
  await db.$transaction(async (tx) => {
    const depois = await tx.usuario.update({ where: { id }, data: { ativo: !antes.ativo } });
    await auditar(tx, {
      usuarioId: eu.id,
      acao: "alternar-ativo",
      entidade: "usuario",
      entidadeId: id,
      antes: semSegredo(antes),
      depois: semSegredo(depois),
    });
  });
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function alterarPerfil(id: string, perfil: string): Promise<EstadoDoFormulario> {
  const eu = await exigirPermissao(ACAO);
  z.uuid().parse(id);
  const novo = z.enum(PERFIS).parse(perfil);
  const antes = await db.usuario.findUniqueOrThrow({ where: { id } });
  if (antes.perfil === "ADMIN_TECNICO" && novo !== "ADMIN_TECNICO" && (await contarAdminsAtivos()) <= 1) {
    return { mensagem: "É preciso manter pelo menos um administrador técnico ativo." };
  }
  await db.$transaction(async (tx) => {
    const depois = await tx.usuario.update({ where: { id }, data: { perfil: novo } });
    await auditar(tx, {
      usuarioId: eu.id,
      acao: "alterar-perfil",
      entidade: "usuario",
      entidadeId: id,
      antes: semSegredo(antes),
      depois: semSegredo(depois),
    });
  });
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function redefinirSenha(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const eu = await exigirPermissao(ACAO);
  z.uuid().parse(id);
  const senha = senhaSchema.safeParse(form.get("senha"));
  if (!senha.success) return { mensagem: senha.error.issues[0]?.message };
  await db.$transaction(async (tx) => {
    await tx.usuario.update({
      where: { id },
      data: { senhaHash: await gerarHashDeSenha(senha.data), trocarSenha: true, tentativasFalhas: 0, bloqueadoAte: null },
    });
    await auditar(tx, { usuarioId: eu.id, acao: "redefinir-senha", entidade: "usuario", entidadeId: id });
  });
  return { ok: true, mensagem: "Senha temporária definida." };
}
