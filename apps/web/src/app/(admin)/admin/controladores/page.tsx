import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { criarControlador } from "@/features/controladores/actions";
import { AcoesDoControlador, FormNovoControlador } from "@/features/controladores/formularios";
import { ROTULO_TIPO } from "@/features/controladores/schema";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Controladores" };

export default async function PaginaDeControladores() {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const [controladores, itensLivres] = await Promise.all([
    db.controlador.findMany({
      orderBy: { item: { codigo: "asc" } },
      include: {
        item: { select: { codigo: true, descricao: true } },
        _count: { select: { saidas: true, modelosCompativeis: true } },
        recursos: { include: { tipoRecurso: { select: { codigo: true } } } },
      },
    }),
    db.itemDeCatalogo.findMany({
      where: { ativo: true, controlador: null },
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, descricao: true },
    }),
  ]);
  return (
    <>
      <CabecalhoDePagina
        titulo="Controladores"
        descricao="Cada controlador é um item do catálogo com funções, saídas funcionais, recursos integrados e compatibilidades. Cadastre só dados da ficha técnica."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem]">
        <Card className="overflow-hidden" role="region" aria-label="Lista de controladores">
          {controladores.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-500">Nenhum controlador cadastrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {controladores.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/controladores/${c.id}`} className="font-medium text-grafite-900 hover:text-marca-700">
                      {c.item.descricao}
                    </Link>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{c.item.codigo}</span> · {ROTULO_TIPO[c.tipo]} · {c._count.saidas} saída(s) funcional(is) ·{" "}
                      {c.recursos.length ? c.recursos.map((r) => `${r.quantidade} ${r.tipoRecurso.codigo}`).join(", ") : "sem recursos integrados"} ·{" "}
                      {c._count.modelosCompativeis} modelo(s) compatível(is)
                    </p>
                  </div>
                  {!c.ativo && <Badge>Inativo</Badge>}
                  {c.isDemo && <Badge tom="demo">DEMO</Badge>}
                  <AcoesDoControlador id={c.id} nome={c.item.descricao} ativo={c.ativo} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Novo controlador</h2>
          <FormNovoControlador acao={criarControlador} itens={itensLivres} />
        </Card>
      </div>
    </>
  );
}
