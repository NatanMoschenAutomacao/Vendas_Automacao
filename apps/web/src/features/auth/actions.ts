"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { conferirSenha, gerarHashDeSenha } from "@/server/auth/password";
import { registrarFalha, senhaSchema } from "@/server/auth/regras-de-senha";
import { criarSessao, encerrarSessao } from "@/server/auth/session";
import { exigirUsuario } from "@/server/auth/dal";
import type { EstadoDoFormulario } from "@/ui/form-status";

const loginSchema = z.object({
  usuario: z.string().trim().toLowerCase().min(1, "Informe o usuário."),
  senha: z.string().min(1, "Informe a senha."),
});

const MSG_INVALIDO = "Usuário ou senha inválidos.";

export async function entrar(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const dados = loginSchema.safeParse({ usuario: form.get("usuario"), senha: form.get("senha") });
  if (!dados.success) return { mensagem: dados.error.issues[0]?.message };

  const u = await db.usuario.findUnique({ where: { usuario: dados.data.usuario } });
  const agora = new Date();

  if (!u || !u.ativo) {
    // Executa um hash mesmo assim, para não revelar pela demora se o usuário existe.
    await gerarHashDeSenha(dados.data.senha);
    return { mensagem: MSG_INVALIDO };
  }
  if (u.bloqueadoAte && u.bloqueadoAte > agora) {
    return { mensagem: "Muitas tentativas erradas. Tente novamente em alguns minutos." };
  }
  if (!(await conferirSenha(u.senhaHash, dados.data.senha))) {
    await db.usuario.update({ where: { id: u.id }, data: registrarFalha(u.tentativasFalhas, agora) });
    return { mensagem: MSG_INVALIDO };
  }

  await db.usuario.update({ where: { id: u.id }, data: { tentativasFalhas: 0, bloqueadoAte: null } });
  await criarSessao({ usuarioId: u.id, perfil: u.perfil });
  redirect(u.trocarSenha ? "/trocar-senha" : u.perfil === "ADMIN_TECNICO" ? "/admin" : "/");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}

const trocaSchema = z
  .object({
    atual: z.string().min(1, "Informe a senha atual."),
    nova: senhaSchema,
    confirmacao: z.string(),
  })
  .refine((d) => d.nova === d.confirmacao, { message: "A confirmação não confere.", path: ["confirmacao"] })
  .refine((d) => d.nova !== d.atual, { message: "A nova senha deve ser diferente da atual.", path: ["nova"] });

export async function trocarSenha(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const eu = await exigirUsuario({ permitirTrocaPendente: true });
  const dados = trocaSchema.safeParse({
    atual: form.get("atual"),
    nova: form.get("nova"),
    confirmacao: form.get("confirmacao"),
  });
  if (!dados.success) {
    const erros: Record<string, string> = {};
    for (const i of dados.error.issues) erros[String(i.path[0])] ??= i.message;
    return { erros };
  }
  const u = await db.usuario.findUniqueOrThrow({ where: { id: eu.id } });
  if (!(await conferirSenha(u.senhaHash, dados.data.atual))) {
    return { erros: { atual: "Senha atual incorreta." } };
  }
  await db.usuario.update({
    where: { id: u.id },
    data: { senhaHash: await gerarHashDeSenha(dados.data.nova), trocarSenha: false },
  });
  redirect(u.perfil === "ADMIN_TECNICO" ? "/admin" : "/");
}
