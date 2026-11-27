"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { calcular } from "@zanatta/engine";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { exigirPermissao, type UsuarioAtual } from "@/server/auth/dal";
import { pode } from "@/server/auth/permissions";
import { auditar } from "@/server/audit";
import { carregarBibliotecaDoConfigurador } from "@/features/configurador/biblioteca";
import { filtroDeAcesso, lerConfiguracao } from "./queries";

/**
 * Status mínimo do orçamento (§41, §42): Rascunho → Aguardando validação →
 * Validado → Emitido. Emitido congela configuração, snapshot e resultado.
 * Sem workflow além disso.
 */
export type ResultadoDoStatus = { ok: true; mensagem: string } | { ok: false; mensagem: string };

const idSchema = z.uuid();

async function carregar(id: string, u: UsuarioAtual) {
  idSchema.parse(id);
  return db.orcamento.findFirst({ where: { id, ...filtroDeAcesso(u) }, include: { revisoes: { orderBy: { numero: "desc" }, take: 1 } } });
}

/** Recalcula no servidor com a biblioteca completa: o valor oficial (§ Princípios). */
async function calcularOficial(configuracao: unknown) {
  const config = lerConfiguracao(configuracao);
  const { snapshot } = await carregarBibliotecaDoConfigurador({ verCusto: true });
  return { config, snapshot, resultado: calcular(config, snapshot) };
}

function revalidar(id: string) {
  revalidatePath("/");
  revalidatePath(`/orcamentos/${id}`, "layout");
}

async function mudarStatus(u: UsuarioAtual, id: string, de: string, para: "RASCUNHO" | "AGUARDANDO_VALIDACAO" | "VALIDADO", acao: string) {
  await db.$transaction(async (tx) => {
    await tx.orcamento.update({ where: { id }, data: { status: para } });
    await auditar(tx, { usuarioId: u.id, acao, entidade: "orcamento", entidadeId: id, antes: { status: de }, depois: { status: para } });
  });
  revalidar(id);
}

export async function enviarParaValidacao(id: string): Promise<ResultadoDoStatus> {
  const u = await exigirPermissao("orcamento:criar");
  const o = await carregar(id, u);
  if (!o) return { ok: false, mensagem: "Orçamento não encontrado." };
  if (o.status !== "RASCUNHO") return { ok: false, mensagem: "Só rascunhos podem ser enviados para validação." };
  await mudarStatus(u, id, o.status, "AGUARDANDO_VALIDACAO", "enviar_validacao");
  return { ok: true, mensagem: "Enviado para validação técnica." };
}

export async function devolverParaRascunho(id: string): Promise<ResultadoDoStatus> {
  const u = await exigirPermissao("orcamento:criar");
  const o = await carregar(id, u);
  if (!o) return { ok: false, mensagem: "Orçamento não encontrado." };
  const validador = pode(u.perfil, "orcamento:validar");
  // O vendedor pode retirar da fila de validação; só o validador desfaz uma validação.
  if (!(o.status === "AGUARDANDO_VALIDACAO" || (o.status === "VALIDADO" && validador))) return { ok: false, mensagem: "Não é possível voltar este orçamento para rascunho." };
  await mudarStatus(u, id, o.status, "RASCUNHO", "voltar_rascunho");
  return { ok: true, mensagem: "O orçamento voltou para rascunho." };
}

export async function validarOrcamento(id: string): Promise<ResultadoDoStatus> {
  const u = await exigirPermissao("orcamento:validar");
  const o = await carregar(id, u);
  if (!o) return { ok: false, mensagem: "Orçamento não encontrado." };
  if (o.status !== "RASCUNHO" && o.status !== "AGUARDANDO_VALIDACAO") return { ok: false, mensagem: "Este orçamento não está aguardando validação." };
  const { resultado } = await calcularOficial(o.revisoes[0]?.configuracao);
  const impeditivas = resultado.pendencias.filter((p) => p.gravidade === "impeditiva").length;
  if (impeditivas) return { ok: false, mensagem: `Há ${impeditivas} pendência(s) impeditiva(s). Resolva antes de validar.` };
  await mudarStatus(u, id, o.status, "VALIDADO", "validar");
  return { ok: true, mensagem: "Orçamento validado tecnicamente." };
}

export async function emitirOrcamento(id: string): Promise<ResultadoDoStatus> {
  const u = await exigirPermissao("orcamento:criar");
  const o = await carregar(id, u);
  if (!o) return { ok: false, mensagem: "Orçamento não encontrado." };
  if (o.status !== "VALIDADO") return { ok: false, mensagem: "Só orçamentos validados podem ser emitidos." };
  const revisao = o.revisoes[0];
  if (!revisao) return { ok: false, mensagem: "Orçamento sem revisão." };
  const { config, snapshot, resultado } = await calcularOficial(revisao.configuracao);
  // A biblioteca pode ter mudado depois da validação: confere de novo.
  const impeditivas = resultado.pendencias.filter((p) => p.gravidade === "impeditiva").length;
  if (impeditivas) return { ok: false, mensagem: `A biblioteca mudou e há ${impeditivas} pendência(s) impeditiva(s). Volte para rascunho e revise.` };
  const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
  await db.$transaction(async (tx) => {
    const e = await tx.emissao.create({
      data: { revisaoId: revisao.id, emitidoPorId: u.id, configuracao: json(config), snapshot: json(snapshot), resultado: json(resultado) },
    });
    await tx.orcamento.update({ where: { id }, data: { status: "EMITIDO" } });
    await auditar(tx, { usuarioId: u.id, acao: "emitir", entidade: "orcamento", entidadeId: id, antes: { status: o.status }, depois: { status: "EMITIDO", emissaoId: e.id, revisao: revisao.numero, total: resultado.precos.total } });
  });
  revalidar(id);
  return { ok: true, mensagem: `Revisão ${revisao.numero} emitida. Os documentos agora saem da emissão congelada.` };
}

/** Abre uma nova revisão a partir da emitida, para alterar sem mexer no que foi enviado ao cliente. */
export async function novaRevisao(id: string): Promise<ResultadoDoStatus> {
  const u = await exigirPermissao("orcamento:criar");
  const o = await carregar(id, u);
  if (!o) return { ok: false, mensagem: "Orçamento não encontrado." };
  if (o.status !== "EMITIDO") return { ok: false, mensagem: "Só orçamentos emitidos abrem nova revisão." };
  const atual = o.revisoes[0]!;
  await db.$transaction(async (tx) => {
    await tx.revisao.create({ data: { orcamentoId: id, numero: atual.numero + 1, configuracao: atual.configuracao as Prisma.InputJsonValue, schemaVersion: atual.schemaVersion } });
    await tx.orcamento.update({ where: { id }, data: { status: "RASCUNHO" } });
    await auditar(tx, { usuarioId: u.id, acao: "nova_revisao", entidade: "orcamento", entidadeId: id, antes: { revisao: atual.numero }, depois: { revisao: atual.numero + 1 } });
  });
  revalidar(id);
  return { ok: true, mensagem: `Revisão ${atual.numero + 1} aberta em rascunho.` };
}
