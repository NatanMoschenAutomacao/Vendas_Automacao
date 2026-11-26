import "server-only";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { montarArvore } from "./arvore";

export async function listarArvoreDeCategorias() {
  await exigirPermissao("biblioteca:ver");
  const itens = await db.categoria.findMany({
    select: { id: true, nome: true, descricao: true, paiId: true, ordem: true, ativo: true, isDemo: true },
  });
  return { arvore: montarArvore(itens), itens };
}

export async function obterCategoria(id: string) {
  await exigirPermissao("biblioteca:ver");
  return db.categoria.findUnique({ where: { id } });
}
