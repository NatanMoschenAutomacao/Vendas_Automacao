import type { Metadata } from "next";
import { PaginaEditorDePergunta } from "@/features/perguntas/pagina-editor";

export const metadata: Metadata = { title: "Nova pergunta" };

export default async function Pagina({ params }: PageProps<"/admin/equipamentos/[id]/perguntas/nova">) {
  const { id } = await params;
  return <PaginaEditorDePergunta equipamentoId={id} />;
}
