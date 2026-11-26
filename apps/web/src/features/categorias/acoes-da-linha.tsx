"use client";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import { alternarAtivoCategoria, duplicarCategoria, excluirCategoria, moverCategoria } from "./actions";

export function AcoesDaLinha({
  id,
  nome,
  ativo,
  primeira,
  ultima,
}: {
  id: string;
  nome: string;
  ativo: boolean;
  primeira: boolean;
  ultima: boolean;
}) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      primeira={primeira}
      ultima={ultima}
      hrefEditar={`/admin/categorias/${id}`}
      subir={() => moverCategoria(id, "cima")}
      descer={() => moverCategoria(id, "baixo")}
      duplicar={() => duplicarCategoria(id)}
      alternarAtivo={() => alternarAtivoCategoria(id)}
      excluir={() => excluirCategoria(id)}
    />
  );
}
