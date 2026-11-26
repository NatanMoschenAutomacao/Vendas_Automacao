import { z } from "zod";

/** Regras de senha, compartilhadas entre cadastro, troca e testes. */
export const senhaSchema = z
  .string()
  .min(8, "A senha precisa ter pelo menos 8 caracteres.")
  .max(128, "A senha pode ter no máximo 128 caracteres.")
  .regex(/[A-Za-z]/, "A senha precisa ter pelo menos uma letra.")
  .regex(/[0-9]/, "A senha precisa ter pelo menos um número.");

export const MAX_TENTATIVAS = 5;
export const BLOQUEIO_MINUTOS = 15;

/** Decide o estado após uma tentativa de login com senha errada. */
export function registrarFalha(tentativasAtuais: number, agora: Date) {
  const tentativas = tentativasAtuais + 1;
  if (tentativas >= MAX_TENTATIVAS) {
    return {
      tentativasFalhas: 0,
      bloqueadoAte: new Date(agora.getTime() + BLOQUEIO_MINUTOS * 60_000),
    };
  }
  return { tentativasFalhas: tentativas, bloqueadoAte: null };
}
