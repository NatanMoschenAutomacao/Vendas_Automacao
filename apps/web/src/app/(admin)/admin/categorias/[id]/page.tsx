import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listarArvoreDeCategorias, obterCategoria } from "@/features/categorias/queries";
import { atualizarCategoria } from "@/features/categorias/actions";
import { FormCategoria } from "@/features/categorias/form-categoria";
import { opcoesDePai } from "@/features/categorias/opcoes-de-pai";
import { descendentes } from "@/features/categorias/arvore";
import { CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Editar categoria" };

export default async function EditarCategoria({ params }: PageProps<"/admin/categorias/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const categoria = await obterCategoria(id);
  if (!categoria) notFound();
  const { arvore, itens } = await listarArvoreDeCategorias();
  const bloqueados = descendentes(itens, id).add(id);

  return (
    <>
      <Link href="/admin/categorias" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Categorias
      </Link>
      <CabecalhoDePagina titulo={categoria.nome} descricao="Editar categoria" />
      <Card className="max-w-xl p-6">
        <FormCategoria
          acao={atualizarCategoria.bind(null, id)}
          opcoesPai={opcoesDePai(arvore, bloqueados)}
          valores={categoria}
          rotuloBotao="Salvar"
        />
      </Card>
    </>
  );
}
