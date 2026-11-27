"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { controladorSchema, recursosSchema, saidasSchema, TIPOS } from "./schema";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();
const CAMINHO = "/admin/controladores";

function revalidar(id?: string) {
  revalidatePath(CAMINHO);
  if (id) revalidatePath(`${CAMINHO}/${id}`);
}

/** Transforma um item do catálogo em controlador. */
export async function criarControlador(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const itemId = idSchema.safeParse(String(form.get("itemId") ?? ""));
  if (!itemId.success) return { erros: { itemId: "Escolha o item do catálogo." } };
  const tipo = z.enum(TIPOS).safeParse(String(form.get("tipo") ?? ""));
  if (!tipo.success) return { erros: { tipo: "Escolha o tipo." } };
  const item = await db.itemDeCatalogo.findUnique({ where: { id: itemId.data }, select: { id: true, isDemo: true, controlador: { select: { id: true } } } });
  if (!item) return { erros: { itemId: "Item não encontrado." } };
  if (item.controlador) return { erros: { itemId: "Este item já é um controlador." } };
  const c = await db.$transaction(async (tx) => {
    const novo = await tx.controlador.create({ data: { itemId: item.id, tipo: tipo.data, tensoes: [], protocolos: [], isDemo: item.isDemo } });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "controlador", entidadeId: novo.id, depois: novo });
    return novo;
  });
  revalidar();
  redirect(`${CAMINHO}/${c.id}`);
}

export async function salvarControlador(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const d = controladorSchema.safeParse({
    tipo: String(form.get("tipo") ?? ""),
    alimentacao: String(form.get("alimentacao") ?? ""),
    tensoes: String(form.get("tensoes") ?? ""),
    protocolos: String(form.get("protocolos") ?? ""),
    observacoes: String(form.get("observacoes") ?? ""),
    barramento: String(form.get("barramento") ?? ""),
    maxModulos: String(form.get("maxModulos") ?? ""),
    consumoMaxBarramento: String(form.get("consumoMaxBarramento") ?? ""),
    isDemo: form.get("isDemo") === "on",
  });
  if (!d.success) {
    const erros: Record<string, string> = {};
    for (const i of d.error.issues) erros[String(i.path[0])] ??= i.message;
    return { erros, mensagem: "Revise os campos destacados." };
  }
  await db.$transaction(async (tx) => {
    const antes = await tx.controlador.findUniqueOrThrow({ where: { id } });
    const depois = await tx.controlador.update({ where: { id }, data: d.data });
    await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "controlador", entidadeId: id, antes, depois });
  });
  revalidar(id);
  return { ok: true, mensagem: "Controlador salvo." };
}

export async function salvarRecursosDoControlador(id: string, json: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { mensagem: "Dados inválidos." };
  }
  const d = recursosSchema.safeParse(bruto);
  if (!d.success) return { mensagem: d.error.issues[0]?.message ?? "Dados inválidos." };
  const tipos = await db.tipoDeRecurso.findMany({ where: { id: { in: Object.keys(d.data) } }, select: { id: true } });
  if (tipos.length !== Object.keys(d.data).length) return { mensagem: "Tipo de recurso não encontrado." };
  await db.$transaction(async (tx) => {
    await tx.recursoDoControlador.deleteMany({ where: { controladorId: id } });
    const linhas = Object.entries(d.data)
      .filter(([, q]) => q > 0)
      .map(([tipoRecursoId, quantidade]) => ({ controladorId: id, tipoRecursoId, quantidade }));
    if (linhas.length) await tx.recursoDoControlador.createMany({ data: linhas });
    await auditar(tx, { usuarioId: u.id, acao: "editar-recursos", entidade: "controlador", entidadeId: id, depois: d.data });
  });
  revalidar(id);
  return { ok: true, mensagem: "Recursos salvos." };
}

export async function salvarSaidasDoControlador(id: string, json: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { mensagem: "Dados inválidos." };
  }
  const d = saidasSchema.safeParse(bruto);
  if (!d.success) {
    const i = d.error.issues[0];
    return { mensagem: i ? (typeof i.path[0] === "number" ? `Saída ${i.path[0] + 1}: ${i.message}` : i.message) : "Dados inválidos." };
  }
  const codigos = d.data.map((s) => s.codigo.toUpperCase());
  const repetido = codigos.find((c, n) => codigos.indexOf(c) !== n);
  if (repetido) return { mensagem: `O código ${repetido} aparece mais de uma vez.` };
  const funcoes = new Set(d.data.flatMap((s) => s.funcoes));
  if ((await db.funcaoDeControle.count({ where: { id: { in: [...funcoes] } } })) !== funcoes.size) return { mensagem: "Função de controle não encontrada." };
  await db.$transaction(async (tx) => {
    const atuais = await tx.saidaFuncional.findMany({ where: { controladorId: id }, select: { id: true } });
    const manter = new Set(d.data.flatMap((s) => (s.id ? [s.id] : [])));
    await tx.saidaFuncional.deleteMany({ where: { controladorId: id, id: { in: atuais.map((a) => a.id).filter((x) => !manter.has(x)) } } });
    // Evita colisão de códigos durante a troca: renomeia temporariamente.
    for (const a of atuais.filter((x) => manter.has(x.id))) await tx.saidaFuncional.update({ where: { id: a.id }, data: { codigo: `__${a.id}` } });
    for (const [ordem, s] of d.data.entries()) {
      const dados = { codigo: s.codigo.toUpperCase(), descricao: s.descricao, ordem, funcoes: { set: s.funcoes.map((f) => ({ id: f })) } };
      if (s.id && atuais.some((a) => a.id === s.id)) await tx.saidaFuncional.update({ where: { id: s.id }, data: dados });
      else
        await tx.saidaFuncional.create({
          data: { controladorId: id, codigo: dados.codigo, descricao: dados.descricao, ordem, funcoes: { connect: s.funcoes.map((f) => ({ id: f })) } },
        });
    }
    await auditar(tx, { usuarioId: u.id, acao: "editar-saidas", entidade: "controlador", entidadeId: id, depois: d.data });
  });
  revalidar(id);
  return { ok: true, mensagem: "Saídas funcionais salvas." };
}

export async function salvarModelosCompativeis(id: string, _: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const ids = z.array(z.uuid()).max(2000).safeParse(form.getAll("modelos").map(String));
  if (!ids.success) return { mensagem: "Seleção inválida." };
  if ((await db.modelo.count({ where: { id: { in: ids.data } } })) !== ids.data.length) return { mensagem: "Modelo não encontrado." };
  await db.$transaction(async (tx) => {
    await tx.controlador.update({ where: { id }, data: { modelosCompativeis: { set: ids.data.map((m) => ({ id: m })) } } });
    await auditar(tx, { usuarioId: u.id, acao: "editar-compatibilidade", entidade: "controlador", entidadeId: id, depois: ids.data });
  });
  revalidar(id);
  return { ok: true, mensagem: `${ids.data.length} modelo(s) compatível(is).` };
}

export async function alternarAtivoControlador(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const c = await tx.controlador.findUniqueOrThrow({ where: { id } });
    await tx.controlador.update({ where: { id }, data: { ativo: !c.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: c.ativo ? "inativar" : "ativar", entidade: "controlador", entidadeId: id });
  });
  revalidar(id);
}

/** Exclui só a extensão de controlador; o item do catálogo continua. */
export async function excluirControlador(id: string, voltar?: boolean) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const antes = await tx.controlador.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "controlador", entidadeId: id, antes });
  });
  revalidar();
  if (voltar) redirect(CAMINHO);
  return { ok: true };
}
