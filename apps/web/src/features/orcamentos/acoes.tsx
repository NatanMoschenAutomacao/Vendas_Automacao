"use client";
import { useRouter } from "next/navigation";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import { excluirOrcamento } from "./actions";

export function AcoesDoOrcamento({ id, numero, voltarAoExcluir }: { id: string; numero: string; voltarAoExcluir?: boolean }) {
  const router = useRouter();
  return (
    <AcoesDeLinha
      nome={`orçamento ${numero}`}
      hrefEditar={`/orcamentos/${id}/dados`}
      excluir={async () => {
        await excluirOrcamento(id);
        if (voltarAoExcluir) router.push("/");
      }}
      avisoExclusao="O rascunho e todas as escolhas serão apagados."
    />
  );
}
