"use client";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import { alternarAtivoPergunta, excluirPergunta, moverPergunta } from "./actions";

export function AcoesDaPergunta({
  id,
  nome,
  ativo,
  primeira,
  ultima,
  hrefEditar,
}: {
  id: string;
  nome: string;
  ativo: boolean;
  primeira: boolean;
  ultima: boolean;
  hrefEditar: string;
}) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      primeira={primeira}
      ultima={ultima}
      hrefEditar={hrefEditar}
      subir={() => moverPergunta(id, "cima")}
      descer={() => moverPergunta(id, "baixo")}
      alternarAtivo={() => alternarAtivoPergunta(id)}
      excluir={() => excluirPergunta(id)}
    />
  );
}
