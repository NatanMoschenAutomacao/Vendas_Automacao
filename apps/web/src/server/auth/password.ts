import "server-only";
import { hash, verify } from "@node-rs/argon2";

export function gerarHashDeSenha(senha: string) {
  return hash(senha);
}

export async function conferirSenha(senhaHash: string, senha: string) {
  try {
    return await verify(senhaHash, senha);
  } catch {
    return false;
  }
}
