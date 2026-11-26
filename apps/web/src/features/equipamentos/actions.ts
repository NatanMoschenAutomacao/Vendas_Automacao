"use server";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { validarAtributos, chaveDoRotulo, type EntradaDeAtributos } from "@zanatta/engine";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { auditar } from "@/server/audit";
import { armazenamento } from "@/server/arquivos/armazenamento";
import { EXTENSAO, validarImagem } from "@/server/arquivos/imagem";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { mover } from "@/features/categorias/arvore";
import {
  edicaoDeDefinicaoSchema,
  equipamentoSchema,
  modeloSchema,
  novaDefinicaoSchema,
} from "./schema";
import { CARACTERISTICAS_ELETRICAS_PADRAO } from "./padroes";

const ACAO = "biblioteca:gerenciar" as const;
const idSchema = z.uuid();
const direcaoSchema = z.enum(["cima", "baixo"]);

function errosDe(issues: z.core.$ZodIssue[]) {
  const erros: Record<string, string> = {};
  for (const i of issues) erros[String(i.path[0])] ??= i.message;
  return erros;
}

const texto = (form: FormData, campo: string) => String(form.get(campo) ?? "");

function caminhoDo(equipamentoId: string) {
  return `/admin/equipamentos/${equipamentoId}`;
}

function revalidar(equipamentoId?: string) {
  revalidatePath("/admin/equipamentos");
  if (equipamentoId) revalidatePath(caminhoDo(equipamentoId), "layout");
}

/* ───────────────────────── Equipamentos ───────────────────────── */

function lerEquipamento(form: FormData) {
  return equipamentoSchema.safeParse({
    codigo: texto(form, "codigo"),
    nome: texto(form, "nome"),
    descricao: texto(form, "descricao"),
    tipo: texto(form, "tipo"),
    categoriaId: texto(form, "categoriaId"),
    isDemo: lerCheckbox(form, "isDemo"),
  });
}

async function codigoEmUso(codigo: string, ignorarId?: string) {
  const e = await db.equipamento.findFirst({
    where: { codigo, NOT: ignorarId ? { id: ignorarId } : undefined },
    select: { id: true },
  });
  return Boolean(e);
}

export async function criarEquipamento(_: EstadoDoFormulario, form: FormData): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  const dados = lerEquipamento(form);
  if (!dados.success) return { erros: errosDe(dados.error.issues) };
  if (await codigoEmUso(dados.data.codigo)) return { erros: { codigo: "Já existe um equipamento com esse código." } };
  if (!(await db.categoria.findUnique({ where: { id: dados.data.categoriaId }, select: { id: true } }))) {
    return { erros: { categoriaId: "Categoria não encontrada." } };
  }
  const ultima = await db.equipamento.aggregate({
    where: { categoriaId: dados.data.categoriaId },
    _max: { ordem: true },
  });
  const e = await db.$transaction(async (tx) => {
    const e = await tx.equipamento.create({ data: { ...dados.data, ordem: (ultima._max.ordem ?? -1) + 1 } });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "equipamento", entidadeId: e.id, depois: e });
    return e;
  });
  revalidar();
  redirect(`${caminhoDo(e.id)}?aba=caracteristicas`);
}

export async function atualizarEquipamento(
  id: string,
  _: EstadoDoFormulario,
  form: FormData,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const dados = lerEquipamento(form);
  if (!dados.success) return { erros: errosDe(dados.error.issues) };
  if (await codigoEmUso(dados.data.codigo, id)) return { erros: { codigo: "Já existe um equipamento com esse código." } };
  await db.$transaction(async (tx) => {
    const antes = await tx.equipamento.findUniqueOrThrow({ where: { id } });
    const mudouCategoria = antes.categoriaId !== dados.data.categoriaId;
    const ordem = mudouCategoria
      ? ((await tx.equipamento.aggregate({ where: { categoriaId: dados.data.categoriaId }, _max: { ordem: true } }))
          ._max.ordem ?? -1) + 1
      : antes.ordem;
    const depois = await tx.equipamento.update({ where: { id }, data: { ...dados.data, ordem } });
    await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "equipamento", entidadeId: id, antes, depois });
  });
  revalidar(id);
  return { ok: true, mensagem: "Dados gerais salvos." };
}

export async function alternarAtivoEquipamento(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  await db.$transaction(async (tx) => {
    const antes = await tx.equipamento.findUniqueOrThrow({ where: { id } });
    const depois = await tx.equipamento.update({ where: { id }, data: { ativo: !antes.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: "alternar-ativo", entidade: "equipamento", entidadeId: id, antes, depois });
  });
  revalidar(id);
}

export async function moverEquipamento(id: string, direcao: "cima" | "baixo") {
  await exigirPermissao(ACAO);
  idSchema.parse(id);
  direcaoSchema.parse(direcao);
  const atual = await db.equipamento.findUniqueOrThrow({ where: { id } });
  const irmaos = await db.equipamento.findMany({
    where: { categoriaId: atual.categoriaId },
    select: { id: true, ordem: true, nome: true },
  });
  const updates = mover(irmaos.map((i) => ({ ...i, paiId: null })), id, direcao);
  await db.$transaction(updates.map((x) => db.equipamento.update({ where: { id: x.id }, data: { ordem: x.ordem } })));
  revalidar();
}

async function proximoCodigoLivre(base: string, emUso: (c: string) => Promise<boolean>) {
  const raiz = base.slice(0, 32);
  let codigo = `${raiz}-COPIA`;
  for (let n = 2; await emUso(codigo); n++) codigo = `${raiz}-COPIA${n}`;
  return codigo;
}

/** Duplica o equipamento com suas características e modelos. Imagens são compartilhadas. */
export async function duplicarEquipamento(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const original = await db.equipamento.findUniqueOrThrow({
    where: { id },
    include: { definicoes: true, modelos: true },
  });
  const codigo = await proximoCodigoLivre(original.codigo, (c) => codigoEmUso(c));
  const ultima = await db.equipamento.aggregate({ where: { categoriaId: original.categoriaId }, _max: { ordem: true } });
  const copia = await db.$transaction(async (tx) => {
    const c = await tx.equipamento.create({
      data: {
        codigo,
        nome: `${original.nome} (cópia)`,
        descricao: original.descricao,
        tipo: original.tipo,
        categoriaId: original.categoriaId,
        imagemId: original.imagemId,
        ativo: original.ativo,
        isDemo: original.isDemo,
        ordem: (ultima._max.ordem ?? -1) + 1,
        definicoes: {
          create: original.definicoes.map(({ chave, rotulo, tipoDado, unidade, opcoes, obrigatorio, ordem }) => ({
            chave,
            rotulo,
            tipoDado,
            unidade,
            opcoes,
            obrigatorio,
            ordem,
          })),
        },
        modelos: {
          create: original.modelos.map((m) => ({
            codigo: m.codigo,
            nome: m.nome,
            fabricante: m.fabricante,
            descricao: m.descricao,
            atributos: m.atributos ?? {},
            imagemId: m.imagemId,
            ordem: m.ordem,
            ativo: m.ativo,
            isDemo: m.isDemo,
          })),
        },
      },
    });
    await auditar(tx, { usuarioId: u.id, acao: "duplicar", entidade: "equipamento", entidadeId: c.id, antes: { id } });
    return c;
  });
  revalidar();
  redirect(caminhoDo(copia.id));
}

export async function excluirEquipamento(id: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const antes = await db.$transaction(async (tx) => {
    const antes = await tx.equipamento.findUniqueOrThrow({ where: { id }, include: { definicoes: true, modelos: true } });
    await tx.equipamento.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "equipamento", entidadeId: id, antes });
    return antes;
  });
  const imagens = new Set([antes.imagemId, ...antes.modelos.map((m) => m.imagemId)].filter((x): x is string => !!x));
  for (const img of imagens) await limparImagemOrfa(img);
  revalidar();
  return { ok: true };
}

/* ─────────────────── Características (definições) ─────────────────── */

function lerCheckbox(form: FormData, campo: string) {
  return form.get(campo) === "on";
}

export async function adicionarDefinicao(
  equipamentoId: string,
  _: EstadoDoFormulario,
  form: FormData,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(equipamentoId);
  const dados = novaDefinicaoSchema.safeParse({
    rotulo: texto(form, "rotulo"),
    tipoDado: texto(form, "tipoDado"),
    unidade: texto(form, "unidade"),
    opcoes: texto(form, "opcoes"),
    obrigatorio: lerCheckbox(form, "obrigatorio"),
  });
  if (!dados.success) return { erros: errosDe(dados.error.issues) };
  const existentes = await db.definicaoDeAtributo.findMany({ where: { equipamentoId }, select: { chave: true, ordem: true } });
  const base = chaveDoRotulo(dados.data.rotulo);
  let chave = base;
  for (let n = 2; existentes.some((e) => e.chave === chave); n++) chave = `${base.slice(0, 36)}_${n}`;
  const ordem = Math.max(-1, ...existentes.map((e) => e.ordem)) + 1;
  await db.$transaction(async (tx) => {
    const d = await tx.definicaoDeAtributo.create({ data: { ...dados.data, equipamentoId, chave, ordem } });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "caracteristica", entidadeId: d.id, depois: d });
  });
  revalidar(equipamentoId);
  return { ok: true, mensagem: `Campo "${dados.data.rotulo}" adicionado.` };
}

export async function atualizarDefinicao(
  id: string,
  _: EstadoDoFormulario,
  form: FormData,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const atual = await db.definicaoDeAtributo.findUniqueOrThrow({ where: { id } });
  const dados = edicaoDeDefinicaoSchema.safeParse({
    rotulo: texto(form, "rotulo"),
    unidade: texto(form, "unidade"),
    opcoes: texto(form, "opcoes"),
    obrigatorio: lerCheckbox(form, "obrigatorio"),
  });
  if (!dados.success) return { erros: errosDe(dados.error.issues) };
  const usaOpcoes = atual.tipoDado === "LISTA" || atual.tipoDado === "MULTIPLA";
  if (usaOpcoes && dados.data.opcoes.length === 0) return { erros: { opcoes: "Informe ao menos uma opção." } };
  await db.$transaction(async (tx) => {
    const depois = await tx.definicaoDeAtributo.update({
      where: { id },
      data: { ...dados.data, opcoes: usaOpcoes ? dados.data.opcoes : [] },
    });
    await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "caracteristica", entidadeId: id, antes: atual, depois });
  });
  revalidar(atual.equipamentoId);
  return { ok: true, mensagem: "Campo salvo." };
}

export async function removerDefinicao(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const antes = await db.$transaction(async (tx) => {
    const antes = await tx.definicaoDeAtributo.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "caracteristica", entidadeId: id, antes });
    return antes;
  });
  revalidar(antes.equipamentoId);
}

export async function moverDefinicao(id: string, direcao: "cima" | "baixo") {
  await exigirPermissao(ACAO);
  idSchema.parse(id);
  direcaoSchema.parse(direcao);
  const atual = await db.definicaoDeAtributo.findUniqueOrThrow({ where: { id } });
  const irmas = await db.definicaoDeAtributo.findMany({
    where: { equipamentoId: atual.equipamentoId },
    select: { id: true, ordem: true, rotulo: true },
  });
  const updates = mover(irmas.map((i) => ({ id: i.id, ordem: i.ordem, nome: i.rotulo, paiId: null })), id, direcao);
  await db.$transaction(updates.map((x) => db.definicaoDeAtributo.update({ where: { id: x.id }, data: { ordem: x.ordem } })));
  revalidar(atual.equipamentoId);
}

/** Adiciona os campos elétricos padrão que ainda não existem (sem valores). */
export async function adicionarCaracteristicasEletricas(equipamentoId: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(equipamentoId);
  const existentes = await db.definicaoDeAtributo.findMany({ where: { equipamentoId }, select: { chave: true, ordem: true } });
  const chaves = new Set(existentes.map((e) => e.chave));
  let ordem = Math.max(-1, ...existentes.map((e) => e.ordem)) + 1;
  const novas = CARACTERISTICAS_ELETRICAS_PADRAO.filter((p) => !chaves.has(p.chave)).map((p) => ({
    equipamentoId,
    chave: p.chave,
    rotulo: p.rotulo,
    tipoDado: p.tipoDado,
    unidade: p.unidade ?? null,
    opcoes: p.opcoes ?? [],
    obrigatorio: false,
    ordem: ordem++,
  }));
  if (novas.length === 0) return;
  await db.$transaction(async (tx) => {
    await tx.definicaoDeAtributo.createMany({ data: novas });
    await auditar(tx, {
      usuarioId: u.id,
      acao: "adicionar-padrao-eletrico",
      entidade: "equipamento",
      entidadeId: equipamentoId,
      depois: novas.map((n) => n.chave),
    });
  });
  revalidar(equipamentoId);
}

/* ───────────────────────────── Modelos ───────────────────────────── */

function lerModelo(form: FormData) {
  return modeloSchema.safeParse({
    codigo: texto(form, "codigo"),
    nome: texto(form, "nome"),
    fabricante: texto(form, "fabricante"),
    descricao: texto(form, "descricao"),
    isDemo: lerCheckbox(form, "isDemo"),
  });
}

async function codigoDeModeloEmUso(equipamentoId: string, codigo: string, ignorarId?: string) {
  const m = await db.modelo.findFirst({
    where: { equipamentoId, codigo, NOT: ignorarId ? { id: ignorarId } : undefined },
    select: { id: true },
  });
  return Boolean(m);
}

/** Lê os campos "attr:<chave>" do formulário (listas para seleção múltipla). */
function entradaDeAtributos(form: FormData): EntradaDeAtributos {
  const entrada: EntradaDeAtributos = {};
  for (const [nome, valor] of form.entries()) {
    if (!nome.startsWith("attr:") || typeof valor !== "string") continue;
    const chave = nome.slice(5);
    const atual = entrada[chave];
    entrada[chave] = atual === undefined ? valor : [...(Array.isArray(atual) ? atual : [atual]), valor];
  }
  return entrada;
}

export async function criarModelo(
  equipamentoId: string,
  _: EstadoDoFormulario,
  form: FormData,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(equipamentoId);
  const dados = lerModelo(form);
  if (!dados.success) return { erros: errosDe(dados.error.issues) };
  if (await codigoDeModeloEmUso(equipamentoId, dados.data.codigo)) {
    return { erros: { codigo: "Este equipamento já tem um modelo com esse código." } };
  }
  const ultima = await db.modelo.aggregate({ where: { equipamentoId }, _max: { ordem: true } });
  const m = await db.$transaction(async (tx) => {
    const m = await tx.modelo.create({ data: { ...dados.data, equipamentoId, ordem: (ultima._max.ordem ?? -1) + 1 } });
    await auditar(tx, { usuarioId: u.id, acao: "criar", entidade: "modelo", entidadeId: m.id, depois: m });
    return m;
  });
  revalidar(equipamentoId);
  redirect(`${caminhoDo(equipamentoId)}/modelos/${m.id}`);
}

export async function atualizarModelo(
  id: string,
  _: EstadoDoFormulario,
  form: FormData,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const atual = await db.modelo.findUniqueOrThrow({
    where: { id },
    include: { equipamento: { select: { definicoes: true } } },
  });
  const dados = lerModelo(form);
  const atributos = validarAtributos(atual.equipamento.definicoes, entradaDeAtributos(form));
  const erros = {
    ...(dados.success ? {} : errosDe(dados.error.issues)),
    ...Object.fromEntries(Object.entries(atributos.erros).map(([k, v]) => [`attr:${k}`, v])),
  };
  if (!dados.success || Object.keys(erros).length > 0) {
    return { erros, mensagem: "Revise os campos destacados." };
  }
  if (await codigoDeModeloEmUso(atual.equipamentoId, dados.data.codigo, id)) {
    return { erros: { codigo: "Este equipamento já tem um modelo com esse código." } };
  }
  await db.$transaction(async (tx) => {
    const antes = { ...atual, equipamento: undefined };
    const depois = await tx.modelo.update({ where: { id }, data: { ...dados.data, atributos: atributos.valores } });
    await auditar(tx, { usuarioId: u.id, acao: "atualizar", entidade: "modelo", entidadeId: id, antes, depois });
  });
  revalidar(atual.equipamentoId);
  return { ok: true, mensagem: "Modelo salvo." };
}

export async function alternarAtivoModelo(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const eqId = await db.$transaction(async (tx) => {
    const antes = await tx.modelo.findUniqueOrThrow({ where: { id } });
    const depois = await tx.modelo.update({ where: { id }, data: { ativo: !antes.ativo } });
    await auditar(tx, { usuarioId: u.id, acao: "alternar-ativo", entidade: "modelo", entidadeId: id, antes, depois });
    return antes.equipamentoId;
  });
  revalidar(eqId);
}

export async function moverModelo(id: string, direcao: "cima" | "baixo") {
  await exigirPermissao(ACAO);
  idSchema.parse(id);
  direcaoSchema.parse(direcao);
  const atual = await db.modelo.findUniqueOrThrow({ where: { id } });
  const irmaos = await db.modelo.findMany({
    where: { equipamentoId: atual.equipamentoId },
    select: { id: true, ordem: true, nome: true },
  });
  const updates = mover(irmaos.map((i) => ({ ...i, paiId: null })), id, direcao);
  await db.$transaction(updates.map((x) => db.modelo.update({ where: { id: x.id }, data: { ordem: x.ordem } })));
  revalidar(atual.equipamentoId);
}

export async function duplicarModelo(id: string) {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const o = await db.modelo.findUniqueOrThrow({ where: { id } });
  const codigo = await proximoCodigoLivre(o.codigo, (c) => codigoDeModeloEmUso(o.equipamentoId, c));
  const ultima = await db.modelo.aggregate({ where: { equipamentoId: o.equipamentoId }, _max: { ordem: true } });
  await db.$transaction(async (tx) => {
    const c = await tx.modelo.create({
      data: {
        equipamentoId: o.equipamentoId,
        codigo,
        nome: `${o.nome} (cópia)`,
        fabricante: o.fabricante,
        descricao: o.descricao,
        atributos: o.atributos ?? {},
        imagemId: o.imagemId,
        ativo: o.ativo,
        isDemo: o.isDemo,
        ordem: (ultima._max.ordem ?? -1) + 1,
      },
    });
    await auditar(tx, { usuarioId: u.id, acao: "duplicar", entidade: "modelo", entidadeId: c.id, antes: { id } });
  });
  revalidar(o.equipamentoId);
}

export async function excluirModelo(id: string): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  idSchema.parse(id);
  const antes = await db.$transaction(async (tx) => {
    const antes = await tx.modelo.delete({ where: { id } });
    await auditar(tx, { usuarioId: u.id, acao: "excluir", entidade: "modelo", entidadeId: id, antes });
    return antes;
  });
  if (antes.imagemId) await limparImagemOrfa(antes.imagemId);
  revalidar(antes.equipamentoId);
  return { ok: true };
}

/* ───────────────────────────── Imagens ───────────────────────────── */

const alvoSchema = z.enum(["equipamento", "modelo"]);
type Alvo = z.infer<typeof alvoSchema>;

async function equipamentoDoAlvo(alvo: Alvo, id: string) {
  if (alvo === "equipamento") return (await db.equipamento.findUniqueOrThrow({ where: { id } })).id;
  return (await db.modelo.findUniqueOrThrow({ where: { id } })).equipamentoId;
}

export async function enviarImagem(
  alvo: Alvo,
  id: string,
  _: EstadoDoFormulario,
  form: FormData,
): Promise<EstadoDoFormulario> {
  const u = await exigirPermissao(ACAO);
  alvoSchema.parse(alvo);
  idSchema.parse(id);
  const arquivo = form.get("arquivo");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erros: { arquivo: "Escolha uma imagem." } };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const v = validarImagem(bytes);
  if (!v.ok) return { erros: { arquivo: v.erro } };
  const textoAlternativo = texto(form, "textoAlternativo").trim().slice(0, 200) || null;

  const equipamentoId = await equipamentoDoAlvo(alvo, id);
  const chave = `${alvo}s/${id}/${randomUUID()}.${EXTENSAO[v.info.tipo]}`;
  try {
    await armazenamento().salvar(chave, bytes, v.info.tipo);
  } catch (e) {
    return { mensagem: e instanceof Error ? e.message : "Falha ao salvar a imagem." };
  }
  const anterior = await db.$transaction(async (tx) => {
    const img = await tx.imagem.create({
      data: {
        chave,
        nomeArquivo: arquivo.name.slice(0, 200) || "imagem",
        tipoMime: v.info.tipo,
        tamanho: bytes.length,
        largura: v.info.largura,
        altura: v.info.altura,
        textoAlternativo,
      },
    });
    const antes =
      alvo === "equipamento"
        ? await tx.equipamento.findUniqueOrThrow({ where: { id }, select: { imagemId: true } })
        : await tx.modelo.findUniqueOrThrow({ where: { id }, select: { imagemId: true } });
    if (alvo === "equipamento") await tx.equipamento.update({ where: { id }, data: { imagemId: img.id } });
    else await tx.modelo.update({ where: { id }, data: { imagemId: img.id } });
    await auditar(tx, {
      usuarioId: u.id,
      acao: "enviar-imagem",
      entidade: alvo,
      entidadeId: id,
      antes,
      depois: { imagemId: img.id, chave },
    });
    return antes.imagemId;
  });
  if (anterior) await limparImagemOrfa(anterior);
  revalidar(equipamentoId);
  return { ok: true, mensagem: "Imagem enviada." };
}

export async function removerImagem(alvo: Alvo, id: string) {
  const u = await exigirPermissao(ACAO);
  alvoSchema.parse(alvo);
  idSchema.parse(id);
  const equipamentoId = await equipamentoDoAlvo(alvo, id);
  const anterior = await db.$transaction(async (tx) => {
    const antes =
      alvo === "equipamento"
        ? await tx.equipamento.findUniqueOrThrow({ where: { id }, select: { imagemId: true } })
        : await tx.modelo.findUniqueOrThrow({ where: { id }, select: { imagemId: true } });
    if (alvo === "equipamento") await tx.equipamento.update({ where: { id }, data: { imagemId: null } });
    else await tx.modelo.update({ where: { id }, data: { imagemId: null } });
    await auditar(tx, { usuarioId: u.id, acao: "remover-imagem", entidade: alvo, entidadeId: id, antes });
    return antes.imagemId;
  });
  if (anterior) await limparImagemOrfa(anterior);
  revalidar(equipamentoId);
}

/** Apaga a imagem do banco e do armazenamento se nenhum cadastro a usa mais. */
async function limparImagemOrfa(imagemId: string) {
  const [eqs, mods] = await Promise.all([
    db.equipamento.count({ where: { imagemId } }),
    db.modelo.count({ where: { imagemId } }),
  ]);
  if (eqs + mods > 0) return;
  const img = await db.imagem.delete({ where: { id: imagemId } }).catch(() => null);
  if (img) await armazenamento().remover(img.chave).catch(() => undefined);
}
