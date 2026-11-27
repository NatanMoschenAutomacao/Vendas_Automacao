import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { criarCategoriaDeComponente, salvarItem } from "@/features/componentes/actions";
import { AcoesDoItem, FormCategoriaDeComponente, FormImportacao, FormItem } from "@/features/componentes/formularios";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";
import { Input, Select } from "@/ui/input";

export const metadata: Metadata = { title: "Componentes" };

export default async function PaginaDeComponentes({ searchParams }: PageProps<"/admin/componentes">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 100) : "";
  const categoria = typeof sp.categoria === "string" && /^[0-9a-f-]{36}$/i.test(sp.categoria) ? sp.categoria : "";
  const [categorias, itens, total] = await Promise.all([
    db.categoriaDeComponente.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }], include: { _count: { select: { itens: true } } } }),
    db.itemDeCatalogo.findMany({
      where: {
        ...(categoria ? { categoriaId: categoria } : {}),
        ...(q
          ? { OR: [{ codigo: { contains: q, mode: "insensitive" } }, { descricao: { contains: q, mode: "insensitive" } }, { fabricante: { contains: q, mode: "insensitive" } }, { codigoFabricante: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { codigo: "asc" },
      take: 300,
      include: { categoria: { select: { nome: true } } },
    }),
    db.itemDeCatalogo.count(),
  ]);
  return (
    <>
      <CabecalhoDePagina
        titulo="Componentes (catálogo central)"
        descricao="Um cadastro único para componentes, sensores, controladores, cartões e acessórios. Preços chegam na Fase 09."
      />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_30rem]">
        <div className="flex flex-col gap-4">
          <form className="flex flex-wrap gap-2" role="search">
            <div className="relative min-w-60 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
              <Input name="q" defaultValue={q} placeholder="Buscar por código, descrição ou fabricante" aria-label="Buscar itens" className="pl-9" />
            </div>
            <Select name="categoria" defaultValue={categoria} aria-label="Filtrar por categoria" className="w-56">
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c._count.itens})
                </option>
              ))}
            </Select>
            <button type="submit" className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium hover:bg-gray-50">
              Filtrar
            </button>
          </form>
          <Card className="overflow-hidden" role="region" aria-label="Itens do catálogo">
            <div className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">
              {itens.length} de {total} item(ns){itens.length === 300 ? " (refine a busca para ver mais)" : ""}
            </div>
            {itens.length === 0 && <p className="px-4 py-12 text-center text-sm text-gray-500">Nenhum item encontrado.</p>}
            {itens.map((i) => (
              <div key={i.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-2.5 last:border-0 hover:bg-gray-50/60">
                <Link href={`/admin/componentes/${i.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">{i.codigo}</span>
                    <span className={i.ativo ? "text-sm font-medium text-grafite-800" : "text-sm text-gray-400 line-through"}>{i.descricao}</span>
                    {!i.ativo && <Badge>Inativo</Badge>}
                    {i.isDemo && <Badge tom="demo">DEMO</Badge>}
                  </div>
                  <p className="text-xs text-gray-500">
                    {i.unidade}
                    {i.fracionavel ? " (fracionável)" : ""}
                    {i.fabricante && ` · ${i.fabricante}`}
                    {i.codigoFabricante && ` ${i.codigoFabricante}`}
                    {i.categoria && ` · ${i.categoria.nome}`}
                  </p>
                </Link>
                <AcoesDoItem id={i.id} nome={i.codigo} ativo={i.ativo} />
              </div>
            ))}
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <h2 className="mb-4 font-medium text-grafite-900">Novo item</h2>
            <FormItem acao={salvarItem.bind(null, null)} categorias={categorias} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 font-medium text-grafite-900">Importar de planilha</h2>
            <FormImportacao />
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-medium text-grafite-900">Categorias</h2>
            <FormCategoriaDeComponente acao={criarCategoriaDeComponente} />
          </Card>
        </div>
      </div>
    </>
  );
}
