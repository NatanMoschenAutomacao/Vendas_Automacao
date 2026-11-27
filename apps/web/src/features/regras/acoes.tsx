"use client";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import { alternarAtivoRegra, duplicarRegra, excluirRegra } from "./actions";

export function AcoesDaRegra({ id, nome, ativo, noCabecalho }: { id: string; nome: string; ativo: boolean; noCabecalho?: boolean }) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      hrefEditar={noCabecalho ? undefined : `/admin/regras/${id}`}
      duplicar={() => duplicarRegra(id)}
      alternarAtivo={() => alternarAtivoRegra(id)}
      excluir={() => excluirRegra(id, noCabecalho ? "/admin/regras" : undefined)}
    />
  );
}
