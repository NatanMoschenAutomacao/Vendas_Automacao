import type { Metadata } from "next";
import { PaginaDeCadastro } from "@/features/cadastros-de-estrutura/pagina";

export const metadata: Metadata = { title: "Tipos de painel" };

export default async function Pagina({ searchParams }: PageProps<"/admin/tipos-de-painel">) {
  const { editar } = await searchParams;
  return <PaginaDeCadastro cadastro="tipo-de-painel" editar={typeof editar === "string" ? editar : undefined} />;
}
