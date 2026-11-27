import "server-only";
import type { ReservaTecnica } from "@zanatta/engine";
import { db } from "@/server/db";
import { RESERVA_NENHUMA, reservaSchema } from "./schema";

export const CHAVE_RESERVA = "reserva_tecnica_padrao";

export async function lerReservaPadrao(): Promise<ReservaTecnica> {
  const c = await db.configuracao.findUnique({ where: { chave: CHAVE_RESERVA } });
  const r = reservaSchema.safeParse(c?.valor);
  return r.success ? r.data : RESERVA_NENHUMA;
}
