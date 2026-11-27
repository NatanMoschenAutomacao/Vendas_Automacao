import type { Metadata } from "next";
import { PaginaDeCadastro } from "@/features/cadastros-de-estrutura/pagina";

export const metadata: Metadata = { title: "Recursos de automação" };

export default async function Pagina({ searchParams }: PageProps<"/admin/recursos">) {
  const { editar } = await searchParams;
  return <PaginaDeCadastro cadastro="tipo-de-recurso" editar={typeof editar === "string" ? editar : undefined} />;
}
