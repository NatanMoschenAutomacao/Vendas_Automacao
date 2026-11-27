import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { salvarItem } from "@/features/componentes/actions";
import { AcoesDoItem, FormItem } from "@/features/componentes/formularios";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Item do catálogo" };

export default async function PaginaDoItem({ params }: PageProps<"/admin/componentes/[id]">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [item, categorias, modelos, regras] = await Promise.all([
    db.itemDeCatalogo.findUnique({ where: { id } }),
    db.categoriaDeComponente.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    db.modelo.findMany({ where: { itemId: id }, select: { id: true, nome: true, equipamento: { select: { id: true, nome: true } } } }),
    db.regra.findMany({ where: { efeitos: { string_contains: id } }, select: { id: true, codigo: true, nome: true } }),
  ]);
  if (!item) notFound();
  return (
    <>
      <Link href="/admin/componentes" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Componentes
      </Link>
      <CabecalhoDePagina
        titulo={item.descricao}
        descricao={item.codigo}
        acoes={
          <div className="flex items-center gap-2">
            {!item.ativo && <Badge>Inativo</Badge>}
            {item.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDoItem id={item.id} nome={item.codigo} ativo={item.ativo} />
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="p-6">
          <FormItem acao={salvarItem.bind(null, item.id)} categorias={categorias} inicial={item} />
        </Card>
        <Card className="h-fit p-5 text-sm">
          <h2 className="mb-2 font-medium text-grafite-900">Onde é usado</h2>
          {modelos.length + regras.length === 0 && <p className="text-gray-500">Ainda não é usado por modelos nem regras.</p>}
          <ul className="flex flex-col gap-1">
            {modelos.map((m) => (
              <li key={m.id}>
                <Link className="text-marca-700 hover:underline" href={`/admin/equipamentos/${m.equipamento.id}/modelos/${m.id}`}>
                  Fornecimento de {m.equipamento.nome} › {m.nome}
                </Link>
              </li>
            ))}
            {regras.map((r) => (
              <li key={r.id}>
                <Link className="text-marca-700 hover:underline" href={`/admin/regras/${r.id}`}>
                  Regra {r.codigo}: {r.nome}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
