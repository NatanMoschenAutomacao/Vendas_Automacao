"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import { armazenarImagemDoFormulario, limparImagemOrfa } from "@/server/arquivos/imagens";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { hotspotsSchema, imagemInterativaSchema } from "./schema";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) erros[String(i.path[0])] ??= i.message;
  return erros;
}

function lerDados(form: FormData) {
  return imagemInterativaSchema.safeParse({
    nome: String(form.get("nome") ?? ""),
    dono: String(form.get("dono") ?? ""),
    isDemo: form.get("isDemo") === "on",
  });
}

async function resolverDono(dono: string) {
  const [tipo, id] = dono.split(":") as ["categoria" | "equipamento", string];
  const existe =
    tipo === "categoria"
      ? await db.categoria.findUnique({ where: { id }, select: { id: true } })
      : await db.equipamento.findUnique({ where: { id }, select: { id: true } });
  if (!existe) return null;
  return tipo === "categoria" ? { categoriaId: id, equipamentoId: null } : { categoriaId: null, equipamentoId: id };
}

function revalidar(id?: string) {
  revalidatePath("/admin/imagens-interativas");
  if (id) revalidatePath(`/admin/imagens-interativas/${id}`);
}

export async function criarImagemInterativa(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const d = lerDados(form);
  if (!d.success) return { erros: errosDe(d.error.issues) };
  const dono = await resolverDono(d.data.dono);
  if (!dono) return { erros: { dono: "Categoria ou equipamento não encontrado." } };
  const img = await armazenarImagemDoFormulario(form, "imagens-interativas");
  if (!img.ok) return { erros: { arquivo: img.erro } };
  const ii = await db.$transaction(async (tx) => {
    const ii = await tx.imagemInterativa.create({
      data: { nome: d.data.nome, isDemo: d.data.isDemo, imagemId: img.imagemId, ...dono },
    });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "imagem-interativa", entidadeId: ii.id, depois: ii });
    return ii;
  });
  revalidar();
  redirect(`/admin/imagens-interativas/${ii.id}`);
}

export async function atualizarImagemInterativa(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const d = lerDados(form);
  if (!d.success) return { erros: errosDe(d.error.issues) };
  const dono = await resolverDono(d.data.dono);
  if (!dono) return { erros: { dono: "Categoria ou equipamento não encontrado." } };
  const antes = await db.imagemInterativa.findUniqueOrThrow({ where: { id }, include: { hotspots: true } });
  if (dono.equipamentoId !== antes.equipamentoId && antes.hotspots.some((h) => h.alvoTipo === "PERGUNTA" || h.alvoTipo === "OPCAO"))
    return { erros: { dono: "Há áreas ligadas a perguntas deste equipamento: remova-as antes de mudar o dono." } };
  let novaImagem: string | null = null;
  const arquivo = form.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    const r = await armazenarImagemDoFormulario(form, "imagens-interativas");
    if (!r.ok) return { erros: { arquivo: r.erro } };
    novaImagem = r.imagemId;
  }
  await db.$transaction(async (tx) => {
    const depois = await tx.imagemInterativa.update({
      where: { id },
      data: { nome: d.data.nome, isDemo: d.data.isDemo, ...dono, ...(novaImagem ? { imagemId: novaImagem } : {}) },
    });
    await auditar(tx, { usuarioId: u.id, acao: "editar", entidade: "imagem-interativa", entidadeId: id, antes, depois });
  });
  if (novaImagem) await limparImagemOrfa(antes.imagemId);
  revalidar(id);
  return { ok: true, mensagem: "Imagem salva." };
}

/**
 * Grava as áreas clicáveis. Confere que cada alvo existe; perguntas e
 * opções só valem em imagem de equipamento, e precisam ser desse equipamento
 * (ou de um modelo dele).
 */
export async function salvarHotspots(id: string, json: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { mensagem: "Dados inválidos." };
  }
  const r = hotspotsSchema.safeParse(bruto);
  if (!r.success) {
    const i = r.error.issues[0];
    return { mensagem: i ? `Área ${Number(i.path[0]) + 1}: ${i.message}` : "Dados inválidos." };
  }
  const ii = await db.imagemInterativa.findUniqueOrThrow({ where: { id } });
  const perguntas = ii.equipamentoId
    ? await db.pergunta.findMany({
        where: { OR: [{ equipamentoId: ii.equipamentoId }, { modelo: { equipamentoId: ii.equipamentoId } }] },
        select: { chave: true, opcoes: true },
      })
    : [];
  const ids = (tipo: string) => r.data.filter((h) => h.alvoTipo === tipo).map((h) => h.alvoId).filter((x) => /^[0-9a-f-]{36}$/i.test(x));
  const [eqs, mods, kits] = await Promise.all([
    db.equipamento.findMany({ where: { id: { in: ids("EQUIPAMENTO") } }, select: { id: true } }),
    db.modelo.findMany({ where: { id: { in: ids("MODELO") } }, select: { id: true, equipamentoId: true } }),
    db.kit.findMany({ where: { id: { in: ids("KIT") } }, select: { id: true } }),
  ]);
  const existe = { EQUIPAMENTO: new Set(eqs.map((x) => x.id)), MODELO: new Set(mods.map((x) => x.id)), KIT: new Set(kits.map((x) => x.id)) };
  for (const [n, h] of r.data.entries()) {
    const erro = (m: string) => ({ mensagem: `Área ${n + 1} (${h.rotulo}): ${m}` });
    if (h.alvoTipo === "EQUIPAMENTO" || h.alvoTipo === "MODELO" || h.alvoTipo === "KIT") {
      if (!existe[h.alvoTipo].has(h.alvoId)) return erro("o alvo não existe mais.");
      continue;
    }
    if (!ii.equipamentoId) return erro("perguntas e opções só podem ser usadas em imagens de um equipamento.");
    const ps = perguntas.filter((p) => p.chave === h.alvoId);
    if (ps.length === 0) return erro("a pergunta não existe neste equipamento.");
    if (h.alvoTipo === "OPCAO") {
      const valores = ps.flatMap((p) => (Array.isArray(p.opcoes) ? (p.opcoes as { valor: string }[]).map((o) => o.valor) : []));
      if (!h.alvoValor || !valores.includes(h.alvoValor)) return erro("escolha uma opção da pergunta.");
    }
  }
  await db.$transaction(async (tx) => {
    const antes = await tx.hotspot.findMany({ where: { imagemInterativaId: id } });
    await tx.hotspot.deleteMany({ where: { imagemInterativaId: id } });
    await tx.hotspot.createMany({
      data: r.data.map((h, ordem) => ({
        ...h,
        alvoValor: h.alvoTipo === "OPCAO" ? h.alvoValor : null,
        imagemInterativaId: id,
        ordem,
      })),
    });
    await auditar(tx, { usuarioId: u.id, acao: "editar-hotspots", entidade: "imagem-interativa", entidadeId: id, antes, depois: r.data });
  });
  revalidar(id);
  return { ok: true, mensagem: "Áreas salvas." };
}

export async function alternarAtivoImagemInterativa(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const ii = await tx.imagemInterativa.findUniqueOrThrow({ where: { id } });
    await tx.imagemInterativa.update({ where: { id }, data: { ativo: !ii.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: ii.ativo ? "inativar" : "ativar", entidade: "imagem-interativa", entidadeId: id });
  });
  revalidar(id);
}

export async function excluirImagemInterativa(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const antes = await db.$transaction(async (tx) => {
    const antes = await tx.imagemInterativa.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "imagem-interativa", entidadeId: id, antes });
    return antes;
  });
  await limparImagemOrfa(antes.imagemId);
  revalidar();
}
