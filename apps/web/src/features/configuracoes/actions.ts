"use server";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { CHAVE_RESERVA } from "./dados";
import { CODIGOS_DE_RESERVA, reservaSchema } from "./schema";

export async function salvarReservaPadrao(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao("configuracoes:gerenciar");
  const valores: Record<string, number> = {};
  for (const c of CODIGOS_DE_RESERVA) {
    const v = String(form.get(`reserva-${c}`) ?? "").replace(",", ".").trim();
    valores[c] = v === "" ? 0 : Number(v);
  }
  const d = reservaSchema.safeParse({ modo: String(form.get("modo") ?? ""), valores });
  if (!d.success) return { mensagem: d.error.issues[0]?.message ?? "Dados inválidos." };
  if (d.data.modo === "percentual" && Object.values(d.data.valores).some((v) => v > 100)) return { mensagem: "O percentual vai de 0 a 100." };
  const valor = { modo: d.data.modo, valores: d.data.valores };
  await db.$transaction(async (tx) => {
    const antes = await tx.configuracao.findUnique({ where: { chave: CHAVE_RESERVA } });
    await tx.configuracao.upsert({ where: { chave: CHAVE_RESERVA }, create: { chave: CHAVE_RESERVA, valor }, update: { valor } });
    await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "configuracao", entidadeId: CHAVE_RESERVA, antes: antes?.valor ?? undefined, depois: valor });
  });
  revalidatePath("/admin/configuracoes");
  return { ok: true, mensagem: "Reserva técnica padrão salva." };
}
