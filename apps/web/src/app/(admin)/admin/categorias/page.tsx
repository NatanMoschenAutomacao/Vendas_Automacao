import type { Metadata } from "next";
import { FolderTree } from "lucide-react";
import { listarArvoreDeCategorias } from "@/features/categorias/queries";
import { criarCategoria } from "@/features/categorias/actions";
import { FormCategoria } from "@/features/categorias/form-categoria";
import { AcoesDaLinha } from "@/features/categorias/acoes-da-linha";
import { opcoesDePai } from "@/features/categorias/opcoes-de-pai";
import type { No } from "@/features/categorias/arvore";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Categorias e sistemas" };

type Item = Awaited<ReturnType<typeof listarArvoreDeCategorias>>["itens"][number];

function Linhas({ nos }: { nos: No<Item>[] }) {
  return (
    <>
      {nos.map((n, i) => (
        <div key={n.id}>
          <div
            className="flex items-center gap-3 border-b border-gray-100 py-2.5 pr-2 last:border-0 hover:bg-gray-50/60"
            style={{ paddingLeft: `${16 + n.nivel * 24}px` }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className={n.ativo ? "font-medium text-grafite-800" : "text-gray-400 line-through"}>
                  {n.nome}
                </span>
                {!n.ativo && <Badge>Inativa</Badge>}
                {n.isDemo && <Badge tom="demo">DEMO</Badge>}
                {n.filhas.length > 0 && <span className="text-xs text-gray-400">{n.filhas.length}</span>}
              </div>
              {n.descricao && <p className="truncate text-xs text-gray-500">{n.descricao}</p>}
            </div>
            <AcoesDaLinha
              id={n.id}
              nome={n.nome}
              ativo={n.ativo}
              primeira={i === 0}
              ultima={i === nos.length - 1}
            />
          </div>
          {n.filhas.length > 0 && <Linhas nos={n.filhas} />}
        </div>
      ))}
    </>
  );
}

export default async function PaginaCategorias() {
  const { arvore, itens } = await listarArvoreDeCategorias();
  return (
    <>
      <CabecalhoDePagina
        titulo="Categorias e sistemas"
        descricao="Organize os sistemas que o vendedor verá no configurador. Inativas não aparecem para o vendedor."
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_21rem]">
        <Card className="overflow-hidden" role="region" aria-label="Árvore de categorias">
          {arvore.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-gray-500">
              <FolderTree className="size-6 text-gray-300" />
              Nenhuma categoria cadastrada.
            </div>
          ) : (
            <div className="py-1">
              <Linhas nos={arvore} />
            </div>
          )}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Nova categoria</h2>
          <FormCategoria acao={criarCategoria} opcoesPai={opcoesDePai(arvore)} rotuloBotao="Adicionar" />
          <p className="mt-4 text-xs text-gray-400">{itens.length} categorias no total.</p>
        </Card>
      </div>
    </>
  );
}
