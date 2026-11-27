import type { Metadata } from "next";
import Link from "next/link";
import { Layers } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { urlDaImagem } from "@/server/arquivos/armazenamento";
import { listarArvoreDeCategorias } from "@/features/categorias/queries";
import { opcoesDePai } from "@/features/categorias/opcoes-de-pai";
import { criarKit } from "@/features/kits/actions";
import { FormKit } from "@/features/kits/formularios";
import { AcoesDoKit } from "@/features/kits/acoes";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Kits" };

export default async function PaginaDeKits() {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const [{ arvore }, kits] = await Promise.all([
    listarArvoreDeCategorias(),
    db.kit.findMany({
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      include: { imagem: { select: { chave: true } }, _count: { select: { itens: true } } },
    }),
  ]);
  const opcoes = opcoesDePai(arvore);
  const grupos = opcoes
    .map((o) => ({ ...o, itens: kits.filter((k) => k.categoriaId === o.id) }))
    .filter((g) => g.itens.length > 0);
  return (
    <>
      <CabecalhoDePagina
        titulo="Kits (conjuntos padrão)"
        descricao="Seleções prontas que o vendedor aplica com um clique, como a estação meteorológica completa."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6" role="region" aria-label="Lista de kits">
          {grupos.length === 0 && (
            <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-gray-500">
              <Layers className="size-6 text-gray-300" />
              Nenhum kit cadastrado.
            </Card>
          )}
          {grupos.map((g) => (
            <section key={g.id}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{g.rotulo.replace(/^(— )+/, "")}</h2>
              <Card className="overflow-hidden">
                {g.itens.map((k, i) => (
                  <div key={k.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50/60">
                    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                      {k.imagem ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urlDaImagem(k.imagem.chave)!} alt="" className="size-full object-cover" />
                      ) : (
                        <Layers className="size-4 text-gray-300" />
                      )}
                    </div>
                    <Link href={`/admin/kits/${k.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={k.ativo ? "font-medium text-grafite-800" : "text-gray-400 line-through"}>{k.nome}</span>
                        {!k.ativo && <Badge>Inativo</Badge>}
                        {k.isDemo && <Badge tom="demo">DEMO</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">
                        {k._count.itens} {k._count.itens === 1 ? "item" : "itens"}
                      </p>
                    </Link>
                    <AcoesDoKit id={k.id} nome={k.nome} ativo={k.ativo} primeira={i === 0} ultima={i === g.itens.length - 1} />
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Novo kit</h2>
          <FormKit acao={criarKit} categorias={opcoes} rotuloBotao="Criar kit" />
        </Card>
      </div>
    </>
  );
}
