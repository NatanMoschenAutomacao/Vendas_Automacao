"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { resolverPerguntas, validarResposta, type ValorDeResposta } from "@zanatta/engine";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import { armazenarImagemDoFormulario, limparImagemOrfa } from "@/server/arquivos/imagens";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { paraPergunta, paraPerguntaDeModelo } from "@/features/perguntas/conversao";
import { itensDoKitSchema, kitSchema } from "./schema";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) erros[String(i.path[0])] ??= i.message;
  return erros;
}

function lerKit(form: FormData) {
  return kitSchema.safeParse({
    nome: String(form.get("nome") ?? ""),
    descricao: String(form.get("descricao") ?? ""),
    categoriaId: String(form.get("categoriaId") ?? ""),
    isDemo: form.get("isDemo") === "on",
  });
}

function revalidar(id?: string) {
  revalidatePath("/admin/kits");
  if (id) revalidatePath(`/admin/kits/${id}`);
}

export async function criarKit(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const d = lerKit(form);
  if (!d.success) return { erros: errosDe(d.error.issues) };
  if (!(await db.categoria.findUnique({ where: { id: d.data.categoriaId }, select: { id: true } })))
    return { erros: { categoriaId: "Categoria não encontrada." } };
  const ultima = await db.kit.aggregate({ where: { categoriaId: d.data.categoriaId }, _max: { ordem: true } });
  const kit = await db.$transaction(async (tx) => {
    const k = await tx.kit.create({ data: { ...d.data, ordem: (ultima._max.ordem ?? -1) + 1 } });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "kit", entidadeId: k.id, depois: k });
    return k;
  });
  revalidar();
  redirect(`/admin/kits/${kit.id}`);
}

export async function atualizarKit(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const d = lerKit(form);
  if (!d.success) return { erros: errosDe(d.error.issues) };
  if (!(await db.categoria.findUnique({ where: { id: d.data.categoriaId }, select: { id: true } })))
    return { erros: { categoriaId: "Categoria não encontrada." } };
  await db.$transaction(async (tx) => {
    const antes = await tx.kit.findUniqueOrThrow({ where: { id } });
    const depois = await tx.kit.update({ where: { id }, data: d.data });
    await auditar(tx, { usuarioId: u.id, acao: "editar", entidade: "kit", entidadeId: id, antes, depois });
  });
  revalidar(id);
  return { ok: true, mensagem: "Kit salvo." };
}

/**
 * Grava a lista de itens do kit. Cada item precisa de um equipamento
 * existente; o modelo, se informado, deve ser dele; as respostas padrão
 * precisam passar na validação das perguntas do equipamento/modelo.
 */
export async function salvarItensDoKit(id: string, json: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { mensagem: "Dados inválidos." };
  }
  const itens = itensDoKitSchema.safeParse(bruto);
  if (!itens.success) return { mensagem: itens.error.issues[0]?.message ?? "Dados inválidos." };

  const ids = [...new Set(itens.data.map((i) => i.equipamentoId))];
  const eqs = await db.equipamento.findMany({
    where: { id: { in: ids } },
    include: {
      perguntas: { where: { ativo: true } },
      modelos: { include: { perguntas: { where: { ativo: true } } } },
    },
  });
  const porId = new Map(eqs.map((e) => [e.id, e]));
  const erros: Record<string, string> = {};
  const limpos = itens.data.map((item, n) => {
    const eq = porId.get(item.equipamentoId);
    if (!eq) {
      erros[`item-${n}`] = "Equipamento não encontrado.";
      return item;
    }
    const modelo = item.modeloId ? eq.modelos.find((m) => m.id === item.modeloId) : undefined;
    if (item.modeloId && !modelo) erros[`item-${n}`] = "O modelo não pertence ao equipamento.";
    const perguntas = resolverPerguntas(eq.perguntas.map(paraPergunta), modelo?.perguntas.map(paraPerguntaDeModelo) ?? []).perguntas;
    const respostas: Record<string, ValorDeResposta> = {};
    for (const [chave, v] of Object.entries(item.respostas)) {
      if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      const p = perguntas.find((x) => x.chave === chave);
      if (!p) continue; // resposta de pergunta que não existe mais: descarta
      const erro = validarResposta(p, v);
      if (erro) erros[`item-${n}`] = `${eq.nome} › "${p.texto}": ${erro}`;
      else respostas[chave] = v;
    }
    return { ...item, respostas };
  });
  if (Object.keys(erros).length) return { erros, mensagem: Object.values(erros)[0] };

  await db.$transaction(async (tx) => {
    const antes = await tx.itemDeKit.findMany({ where: { kitId: id } });
    await tx.itemDeKit.deleteMany({ where: { kitId: id } });
    await tx.itemDeKit.createMany({ data: limpos.map((i, ordem) => ({ ...i, kitId: id, ordem })) });
    await auditar(tx, { usuarioId: u.id, acao: "editar-itens", entidade: "kit", entidadeId: id, antes, depois: limpos });
  });
  revalidar(id);
  return { ok: true, mensagem: "Itens salvos." };
}

export async function alternarAtivoKit(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const k = await tx.kit.findUniqueOrThrow({ where: { id } });
    await tx.kit.update({ where: { id }, data: { ativo: !k.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: k.ativo ? "inativar" : "ativar", entidade: "kit", entidadeId: id });
  });
  revalidar(id);
}

export async function moverKit(id: string, direcao: "cima" | "baixo") {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  z.enum(["cima", "baixo"]).parse(direcao);
  const k = await db.kit.findUniqueOrThrow({ where: { id } });
  const irmaos = await db.kit.findMany({ where: { categoriaId: k.categoriaId }, orderBy: [{ ordem: "asc" }, { nome: "asc" }] });
  const pos = irmaos.findIndex((x) => x.id === id);
  const alvo = direcao === "cima" ? pos - 1 : pos + 1;
  if (alvo < 0 || alvo >= irmaos.length) return;
  [irmaos[pos], irmaos[alvo]] = [irmaos[alvo]!, irmaos[pos]!];
  await db.$transaction(async (tx) => {
    for (const [ordem, x] of irmaos.entries()) await tx.kit.update({ where: { id: x.id }, data: { ordem } });
    await auditar(tx, { usuarioId: u.id, acao: "reordenar", entidade: "kit", entidadeId: id });
  });
  revalidar();
}

export async function excluirKit(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const antes = await db.$transaction(async (tx) => {
    const antes = await tx.kit.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "kit", entidadeId: id, antes });
    return antes;
  });
  if (antes.imagemId) await limparImagemOrfa(antes.imagemId);
  revalidar();
}

export async function enviarImagemDoKit(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const r = await armazenarImagemDoFormulario(form, `kits/${id}`);
  if (!r.ok) return { erros: { arquivo: r.erro } };
  const anterior = await db.$transaction(async (tx) => {
    const antes = await tx.kit.findUniqueOrThrow({ where: { id }, select: { imagemId: true } });
    await tx.kit.update({ where: { id }, data: { imagemId: r.imagemId } });
    await auditar(tx, { usuarioId: u.id, acao: "enviar-imagem", entidade: "kit", entidadeId: id, antes, depois: { imagemId: r.imagemId } });
    return antes.imagemId;
  });
  if (anterior) await limparImagemOrfa(anterior);
  revalidar(id);
  return { ok: true, mensagem: "Imagem enviada." };
}

export async function removerImagemDoKit(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const anterior = await db.$transaction(async (tx) => {
    const antes = await tx.kit.findUniqueOrThrow({ where: { id }, select: { imagemId: true } });
    await tx.kit.update({ where: { id }, data: { imagemId: null } });
    await auditar(tx, { usuarioId: u.id, acao: "remover-imagem", entidade: "kit", entidadeId: id, antes });
    return antes.imagemId;
  });
  if (anterior) await limparImagemOrfa(anterior);
  revalidar(id);
}
