import type { Metadata } from "next";
import { PaginaDeCadastro } from "@/features/cadastros-de-estrutura/pagina";

export const metadata: Metadata = { title: "Funções de controle" };

export default async function Pagina({ searchParams }: PageProps<"/admin/funcoes-de-controle">) {
  const { editar } = await searchParams;
  return <PaginaDeCadastro cadastro="funcao-de-controle" editar={typeof editar === "string" ? editar : undefined} />;
}
