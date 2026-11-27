"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { DonoDaRegra } from "@zanatta/engine";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { carregarDono, donoDoBanco, donoParaBanco, lerDono } from "./dados";
import { ESTAGIO_PARA_BANCO, regraSchema } from "./schema";
import { validarRegra } from "./validacao";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();

function revalidar(id?: string) {
  revalidatePath("/admin/regras");
  revalidatePath("/admin/equipamentos", "layout");
  if (id) revalidatePath(`/admin/regras/${id}`);
}

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) {
    const chave = i.path[0] === "efeitos" && typeof i.path[1] === "number" ? `efeito-${i.path[1]}` : String(i.path[0] ?? "geral");
    erros[chave] ??= i.message;
  }
  return erros;
}

/**
 * Cria (id = null, com dono) ou atualiza uma regra. O dono de uma regra
 * existente não muda.
 */
export async function salvarRegra(
  donoInformado: { tipo: string; id?: string } | null,
  id: string | null,
  json: string,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  if (id) idSchema.parse(id);
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return { mensagem: "Dados inválidos." };
  }
  const d = regraSchema.safeParse(bruto);
  if (!d.success) return { erros: errosDe(d.error.issues), mensagem: "Corrija os campos destacados." };

  const anterior = id ? await db.regra.findUnique({ where: { id } }) : null;
  if (id && !anterior) return { mensagem: "Regra não encontrada." };
  const dono: DonoDaRegra | null = anterior ? donoDoBanco(anterior) : lerDono(donoInformado?.tipo, donoInformado?.id);
  if (!dono) return { mensagem: "Dono da regra inválido." };
  const ctxDono = await carregarDono(dono);
  if (!ctxDono) return { mensagem: "O dono da regra não existe mais." };

  const ids = d.data.efeitos.flatMap((e) => (e.acao === "recurso" || e.acao === "servico" ? [] : e.acao === "substituir" ? [e.itemId, e.substitutoId] : [e.itemId]));
  const servicosIds = d.data.efeitos.flatMap((e) => (e.acao === "servico" ? [e.servicoId] : []));
  const recursosIds = d.data.efeitos.flatMap((e) => (e.acao === "recurso" ? [e.tipoRecursoId] : []));
  const [itens, recursos, servicos] = await Promise.all([
    db.itemDeCatalogo.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    db.tipoDeRecurso.findMany({ where: { id: { in: recursosIds } }, select: { id: true } }),
    db.servico.findMany({ where: { id: { in: servicosIds } }, select: { id: true } }),
  ]);
  const erros = validarRegra(d.data, {
    dono: dono.tipo,
    comuns: ctxDono.comuns,
    itens: new Set(itens.map((i) => i.id)),
    recursos: new Set(recursos.map((r) => r.id)),
    servicos: new Set(servicos.map((s) => s.id)),
  });
  if (Object.keys(erros).length) return { erros, mensagem: "Corrija os campos destacados." };

  const dados = {
    ...d.data,
    condicao: d.data.condicao ?? Prisma.DbNull,
    estagio: ESTAGIO_PARA_BANCO[d.data.estagio],
    efeitos: d.data.efeitos as unknown as Prisma.InputJsonValue,
  };
  try {
    const salva = await db.$transaction(async (tx) => {
      const r = anterior
        ? await tx.regra.update({ where: { id: anterior.id }, data: dados })
        : await tx.regra.create({ data: { ...dados, ...donoParaBanco(dono) } });
      await auditar(tx, { usuarioId: u.id, acao: anterior ? "atualizar" : "criar", entidade: "regra", entidadeId: r.id, antes: anterior ?? undefined, depois: r });
      return r;
    });
    revalidar(salva.id);
    if (!anterior) redirect(`/admin/regras/${salva.id}?criada=1`);
    return { ok: true, mensagem: "Regra salva." };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { erros: { codigo: "Já existe uma regra com esse código." }, mensagem: "Corrija os campos destacados." };
    throw e;
  }
}

export async function alternarAtivoRegra(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const r = await db.regra.findUnique({ where: { id } });
  if (!r) return;
  await db.$transaction(async (tx) => {
    const depois = await tx.regra.update({ where: { id }, data: { ativo: !r.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "regra", entidadeId: id, antes: r, depois });
  });
  revalidar(id);
}

export async function duplicarRegra(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const r = await db.regra.findUnique({ where: { id } });
  if (!r) return;
  let codigo = `${r.codigo}-COPIA`.slice(0, 40);
  for (let n = 2; await db.regra.findUnique({ where: { codigo }, select: { id: true } }); n++) codigo = `${r.codigo}-COPIA${n}`.slice(0, 40);
  await db.$transaction(async (tx) => {
    const nova = await tx.regra.create({
      data: {
        descricao: r.descricao,
        donoTipo: r.donoTipo,
        equipamentoId: r.equipamentoId,
        modeloId: r.modeloId,
        tipoDePainelId: r.tipoDePainelId,
        estagio: r.estagio,
        base: r.base,
        prioridade: r.prioridade,
        permiteRemocao: r.permiteRemocao,
        isDemo: r.isDemo,
        codigo,
        nome: `${r.nome} (cópia)`.slice(0, 120),
        ativo: false,
        condicao: r.condicao ?? Prisma.DbNull,
        efeitos: r.efeitos as Prisma.InputJsonValue,
      },
    });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "regra", entidadeId: nova.id, depois: nova });
  });
  revalidar();
}

export async function excluirRegra(id: string, voltar?: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const r = await db.regra.findUnique({ where: { id } });
  if (!r) return { ok: false, mensagem: "Regra não encontrada." };
  await db.$transaction(async (tx) => {
    await tx.regra.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "regra", entidadeId: id, antes: r });
  });
  revalidar();
  if (voltar) redirect(voltar.startsWith("/admin/") ? voltar : "/admin/regras");
  return { ok: true };
}
