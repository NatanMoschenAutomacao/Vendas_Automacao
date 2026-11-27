import type { Metadata } from "next";
import { PaginaEditorDePergunta } from "@/features/perguntas/pagina-editor";

export const metadata: Metadata = { title: "Pergunta" };

export default async function Pagina({ params }: PageProps<"/admin/equipamentos/[id]/perguntas/[perguntaId]">) {
  const { id, perguntaId } = await params;
  return <PaginaEditorDePergunta equipamentoId={id} perguntaId={perguntaId} />;
}
