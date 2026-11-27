import "server-only";
import type { ConfiguracaoDoProjeto } from "@zanatta/engine";
import { db } from "@/server/db";
import { exigirPermissao, type UsuarioAtual } from "@/server/auth/dal";
import { pode } from "@/server/auth/permissions";
import { CONFIGURACAO_VAZIA, configuracaoSchema } from "./schema";

export function filtroDeAcesso(u: UsuarioAtual) {
  return pode(u.perfil, "orcamento:ver-todos") ? {} : { vendedorId: u.id };
}

export async function listarOrcamentos() {
  const u = await exigirPermissao("orcamento:ver");
  const orcamentos = await db.orcamento.findMany({
    where: filtroDeAcesso(u),
    orderBy: { atualizadoEm: "desc" },
    take: 200,
    select: {
      id: true,
      numero: true,
      cliente: true,
      empresa: true,
      projeto: true,
      cidade: true,
      uf: true,
      status: true,
      atualizadoEm: true,
      vendedor: { select: { nome: true } },
      revisoes: { orderBy: { numero: "desc" }, take: 1, select: { configuracao: true } },
    },
  });
  return orcamentos.map(({ revisoes, ...o }) => ({ ...o, itens: lerConfiguracao(revisoes[0]?.configuracao).instancias.length }));
}

/** Lê a configuração salva; um JSON inválido vira configuração vazia em vez de quebrar a tela. */
export function lerConfiguracao(json: unknown): ConfiguracaoDoProjeto {
  const r = configuracaoSchema.safeParse(json);
  return r.success ? r.data : CONFIGURACAO_VAZIA;
}

export async function obterOrcamento(id: string) {
  const u = await exigirPermissao("orcamento:ver");
  const o = await db.orcamento.findFirst({
    where: { id, ...filtroDeAcesso(u) },
    include: {
      vendedor: { select: { nome: true } },
      revisoes: { orderBy: { numero: "desc" }, take: 1 },
    },
  });
  if (!o) return null;
  const revisao = o.revisoes[0] ?? null;
  return { ...o, revisao, configuracao: lerConfiguracao(revisao?.configuracao) };
}
