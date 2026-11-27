import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { criarCartao } from "@/features/cartoes/actions";
import { AcoesDoCartao, FormNovoCartao } from "@/features/cartoes/formularios";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Cartões de expansão" };

export default async function PaginaDeCartoes() {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const [cartoes, itensLivres] = await Promise.all([
    db.cartaoDeExpansao.findMany({
      orderBy: { item: { codigo: "asc" } },
      include: {
        item: { select: { codigo: true, descricao: true } },
        recursos: { include: { tipoRecurso: { select: { codigo: true } } } },
        _count: { select: { controladores: true } },
      },
    }),
    db.itemDeCatalogo.findMany({
      where: { ativo: true, cartao: null, controlador: null },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, descricao: true },
    }),
  ]);
  return (
    <>
      <CabecalhoDePagina
        titulo="Cartões de expansão"
        descricao="Pontos de I/O por cartão, barramento, consumo e com quais CLPs cada cartão é compatível. Só cartões compatíveis entram na busca."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className="overflow-hidden" role="region" aria-label="Lista de cartões">
          {cartoes.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-500">Nenhum cartão cadastrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {cartoes.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/cartoes/${c.id}`} className="font-medium text-grafite-900 hover:text-marca-700">
                      {c.item.descricao}
                    </Link>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{c.item.codigo}</span> ·{" "}
                      {c.recursos.length ? c.recursos.map((r) => `${r.quantidade} ${r.tipoRecurso.codigo}`).join(", ") : "sem pontos cadastrados"}
                      {c.barramento ? ` · barramento ${c.barramento}` : ""} · {c._count.controladores} controlador(es) compatível(is)
                    </p>
                  </div>
                  {!c.ativo && <Badge>Inativo</Badge>}
                  {c.isDemo && <Badge tom="demo">DEMO</Badge>}
                  <AcoesDoCartao id={c.id} nome={c.item.descricao} ativo={c.ativo} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Novo cartão</h2>
          <FormNovoCartao acao={criarCartao} itens={itensLivres} />
        </Card>
      </div>
    </>
  );
}
