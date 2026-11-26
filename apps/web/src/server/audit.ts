import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

type Cliente = Pick<typeof db, "registroDeAuditoria">;

export async function auditar(
  cliente: Cliente,
  dados: {
    usuarioId: string;
    acao: string;
    entidade: string;
    entidadeId?: string;
    antes?: Prisma.InputJsonValue;
    depois?: Prisma.InputJsonValue;
  },
) {
  await cliente.registroDeAuditoria.create({ data: dados });
}
