"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { PerguntaDeModelo } from "@zanatta/engine";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { mover } from "@/features/categorias/arvore";
import { carregarPerguntasDoEquipamento } from "./dados";
import { perguntaSchema } from "./schema";
import { validarPergunta } from "./validacao";
import { Prisma } from "@/generated/prisma/client";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();

export type Dono = { equipamentoId: string; modeloId?: undefined } | { modeloId: string; equipamentoId?: undefined };

async function equipamentoDoDono(dono: Dono) {
  if (dono.equipamentoId) return idSchema.parse(dono.equipamentoId);
  const m = await db.modelo.findUniqueOrThrow({ where: { id: idSchema.parse(dono.modeloId) }, select: { equipamentoId: true } });
  return m.equipamentoId;
}

function caminho(equipamentoId: string, dono: Dono) {
  return dono.modeloId
    ? `/admin/equipamentos/${equipamentoId}/modelos/${dono.modeloId}`
    : `/admin/equipamentos/${equipamentoId}?aba=perguntas`;
}

/** Cria (id = null) ou atualiza uma pergunta. Os dados chegam como JSON no campo "dados". */
export async function salvarPergunta(
  dono: Dono,
  id: string | null,
  _: EstadoDoFormulario,
  form: FormData,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  if (id) idSchema.parse(id);
  const equipamentoId = await equipamentoDoDono(dono);

  let bruto: unknown;
  try {
    bruto = JSON.parse(String(form.get("dados") ?? ""));
  } catch {
    return { mensagem: "Dados do formulário inválidos." };
  }
  const parse = perguntaSchema.safeParse(bruto);
  if (!parse.success) {
    const erros: Record<string, string> = {};
    for (const i of parse.error.issues) erros[String(i.path[0] ?? "geral")] ??= i.message;
    return { erros, mensagem: "Revise os campos destacados." };
  }
  const d = parse.data;

  const eq = await carregarPerguntasDoEquipamento(equipamentoId);
  const atual = id ? await db.pergunta.findUniqueOrThrow({ where: { id } }) : null;
  if (atual && (atual.equipamentoId ?? undefined) !== dono.equipamentoId && (atual.modeloId ?? undefined) !== dono.modeloId) {
    return { mensagem: "Pergunta de outro dono." };
  }
  const ignorar = atual?.chave;
  const porModelo = new Map<string, PerguntaDeModelo[]>(
    eq.modelosMotor.map((m) => [m.id, m.perguntas.filter((p) => !(dono.modeloId === m.id && p.chave === ignorar))]),
  );
  const doEquipamento = eq.perguntasMotor.filter((p) => !(dono.equipamentoId && p.chave === ignorar));

  // Pergunta inativa não entra nas checagens de conjunto.
  const ordem =
    atual?.ordem ??
    ((
      await db.pergunta.aggregate({
        where: dono.equipamentoId ? { equipamentoId } : { modeloId: dono.modeloId },
        _max: { ordem: true },
      })
    )._max.ordem ?? -1) + 1;
  const erros = d.ativo
    ? validarPergunta(d, ordem, {
        dono: dono.equipamentoId ? "equipamento" : "modelo",
        doEquipamento,
        porModelo,
        modeloId: dono.modeloId,
        definicoes: eq.definicoes,
      })
    : {};
  if (Object.keys(erros).length) return { erros, mensagem: erros.geral ?? "Revise os campos destacados." };

  // Mudar a chave de uma pergunta usada por modelos quebraria a herança.
  if (atual && dono.equipamentoId && atual.chave !== d.chave) {
    const usada = eq.modelosMotor.some((m) => m.perguntas.some((p) => p.chave === atual.chave));
    if (usada) return { erros: { chave: "Modelos substituem ou ocultam esta pergunta: a chave não pode mudar." } };
  }

  const dados = {
    ...d,
    padrao: d.padrao ?? Prisma.JsonNull,
    condicao: d.condicao ?? Prisma.JsonNull,
    opcoes: d.opcoes,
  };
  await db.$transaction(async (tx) => {
    if (atual) {
      const depois = await tx.pergunta.update({ where: { id: atual.id }, data: dados });
      await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "pergunta", entidadeId: atual.id, antes: atual, depois });
    } else {
      const nova = await tx.pergunta.create({
        data: { ...dados, ordem, equipamentoId: dono.equipamentoId ?? null, modeloId: dono.modeloId ?? null },
      });
      await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "pergunta", entidadeId: nova.id, depois: nova });
    }
  });
  revalidatePath(`/admin/equipamentos/${equipamentoId}`, "layout");
  redirect(caminho(equipamentoId, dono));
}

export async function excluirPergunta(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const p = await db.pergunta.findUniqueOrThrow({ where: { id } });
  const equipamentoId = p.equipamentoId ?? (await equipamentoDoDono({ modeloId: p.modeloId! }));
  if (p.equipamentoId) {
    const usada = await db.pergunta.count({ where: { modelo: { equipamentoId: p.equipamentoId }, chave: p.chave } });
    if (usada) return { ok: false, mensagem: "Modelos substituem ou ocultam esta pergunta. Remova isso nos modelos antes." };
    const eq = await carregarPerguntasDoEquipamento(p.equipamentoId);
    const dependentes = eq.perguntasMotor.filter((x) => x.chave !== p.chave && JSON.stringify([x.condicao, x.opcoes, x.formula]).includes(`resposta.${p.chave}`));
    if (dependentes.length) return { ok: false, mensagem: `Outras perguntas dependem desta: ${dependentes.map((x) => x.texto).join(", ")}.` };
  }
  await db.$transaction(async (tx) => {
    await tx.pergunta.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "pergunta", entidadeId: id, antes: p });
  });
  revalidatePath(`/admin/equipamentos/${equipamentoId}`, "layout");
  return { ok: true };
}

export async function moverPergunta(id: string, direcao: "cima" | "baixo") {
  await exigirPermissao(ACAO);
  idSchema.parse(id);
  z.enum(["cima", "baixo"]).parse(direcao);
  const p = await db.pergunta.findUniqueOrThrow({ where: { id } });
  const irmas = await db.pergunta.findMany({
    where: p.equipamentoId ? { equipamentoId: p.equipamentoId } : { modeloId: p.modeloId },
    select: { id: true, ordem: true, chave: true },
  });
  const updates = mover(irmas.map((i) => ({ id: i.id, ordem: i.ordem, nome: i.chave, paiId: null })), id, direcao);
  await db.$transaction(updates.map((x) => db.pergunta.update({ where: { id: x.id }, data: { ordem: x.ordem } })));
  const equipamentoId = p.equipamentoId ?? (await equipamentoDoDono({ modeloId: p.modeloId! }));
  revalidatePath(`/admin/equipamentos/${equipamentoId}`, "layout");
}

export async function alternarAtivoPergunta(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const antes = await db.pergunta.findUniqueOrThrow({ where: { id } });
  await db.$transaction(async (tx) => {
    const depois = await tx.pergunta.update({ where: { id }, data: { ativo: !antes.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: "alternar-ativo", entidade: "pergunta", entidadeId: id, antes, depois });
  });
  const equipamentoId = antes.equipamentoId ?? (await equipamentoDoDono({ modeloId: antes.modeloId! }));
  revalidatePath(`/admin/equipamentos/${equipamentoId}`, "layout");
}
