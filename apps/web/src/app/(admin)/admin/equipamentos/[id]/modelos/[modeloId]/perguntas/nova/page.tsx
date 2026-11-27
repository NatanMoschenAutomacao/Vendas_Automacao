import type { Metadata } from "next";
import { PaginaEditorDePergunta } from "@/features/perguntas/pagina-editor";

export const metadata: Metadata = { title: "Nova pergunta do modelo" };

export default async function Pagina({ params }: PageProps<"/admin/equipamentos/[id]/modelos/[modeloId]/perguntas/nova">) {
  const { id, modeloId } = await params;
  return <PaginaEditorDePergunta equipamentoId={id} modeloId={modeloId} />;
}
