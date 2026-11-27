import type { Metadata } from "next";
import { PaginaEditorDePergunta } from "@/features/perguntas/pagina-editor";

export const metadata: Metadata = { title: "Pergunta do modelo" };

export default async function Pagina({
  params,
}: PageProps<"/admin/equipamentos/[id]/modelos/[modeloId]/perguntas/[perguntaId]">) {
  const { id, modeloId, perguntaId } = await params;
  return <PaginaEditorDePergunta equipamentoId={id} modeloId={modeloId} perguntaId={perguntaId} />;
}
