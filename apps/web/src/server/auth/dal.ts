import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { lerSessao } from "./session";
import { pode, type Acao, type PerfilUsuario } from "./permissions";

export interface UsuarioAtual {
  id: string;
  usuario: string;
  nome: string;
  perfil: PerfilUsuario;
  trocarSenha: boolean;
}

/**
 * Camada de acesso a dados da autenticação. Lê o cookie e confirma no banco
 * que o usuário existe e está ativo: desativar um usuário corta o acesso
 * na próxima requisição, sem esperar o cookie expirar.
 */
export const obterUsuarioAtual = cache(async (): Promise<UsuarioAtual | null> => {
  const sessao = await lerSessao();
  if (!sessao) return null;
  const u = await db.usuario.findUnique({
    where: { id: sessao.usuarioId },
    select: { id: true, usuario: true, nome: true, perfil: true, ativo: true, trocarSenha: true },
  });
  if (!u || !u.ativo) return null;
  return { id: u.id, usuario: u.usuario, nome: u.nome, perfil: u.perfil, trocarSenha: u.trocarSenha };
});

/** Exige login. Redireciona para /login se não houver sessão válida. */
export async function exigirUsuario(opcoes?: { permitirTrocaPendente?: boolean }) {
  const u = await obterUsuarioAtual();
  if (!u) redirect("/login");
  if (u.trocarSenha && !opcoes?.permitirTrocaPendente) redirect("/trocar-senha");
  return u;
}

export class SemPermissao extends Error {
  constructor(acao: Acao) {
    super(`Sem permissão para: ${acao}`);
  }
}

/** Exige login e permissão para a ação. Use em toda Server Action. */
export async function exigirPermissao(acao: Acao) {
  const u = await exigirUsuario();
  if (!pode(u.perfil, acao)) throw new SemPermissao(acao);
  return u;
}

/** Versão para páginas: redireciona em vez de lançar erro. */
export async function exigirPermissaoNaPagina(acao: Acao) {
  const u = await exigirUsuario();
  if (!pode(u.perfil, acao)) redirect("/");
  return u;
}
