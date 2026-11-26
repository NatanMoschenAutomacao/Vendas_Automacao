import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import type { PerfilUsuario } from "./permissions";

export const COOKIE_SESSAO = "zv_sessao";
const DURACAO_HORAS = 12;

function chave() {
  const segredo = process.env.SESSION_SECRET;
  if (!segredo || segredo.length < 32) {
    throw new Error("SESSION_SECRET ausente ou curto (mínimo 32 caracteres).");
  }
  return new TextEncoder().encode(segredo);
}

export interface DadosDaSessao {
  usuarioId: string;
  perfil: PerfilUsuario;
}

export async function criarSessao(dados: DadosDaSessao) {
  const expira = new Date(Date.now() + DURACAO_HORAS * 3600_000);
  const token = await new SignJWT({ perfil: dados.perfil })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(dados.usuarioId)
    .setIssuedAt()
    .setExpirationTime(expira)
    .sign(chave());
  (await cookies()).set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expira,
  });
}

export async function lerSessao(): Promise<DadosDaSessao | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { usuarioId: payload.sub, perfil: payload.perfil as PerfilUsuario };
  } catch {
    return null;
  }
}

export async function encerrarSessao() {
  (await cookies()).delete(COOKIE_SESSAO);
}
