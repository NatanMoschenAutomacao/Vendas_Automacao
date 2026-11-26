import type { Metadata } from "next";
import Link from "next/link";
import { ImageOff, Package } from "lucide-react";
import { listarArvoreDeCategorias } from "@/features/categorias/queries";
import { opcoesDePai } from "@/features/categorias/opcoes-de-pai";
import { listarEquipamentos } from "@/features/equipamentos/queries";
import { FormEquipamento } from "@/features/equipamentos/formularios";
import { AcoesDoEquipamento } from "@/features/equipamentos/acoes";
import { criarEquipamento } from "@/features/equipamentos/actions";
import { ROTULO_TIPO_EQUIPAMENTO } from "@/features/equipamentos/schema";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Equipamentos e modelos" };

export default async function PaginaEquipamentos() {
  const [{ arvore, itens: categorias }, equipamentos] = await Promise.all([
    listarArvoreDeCategorias(),
    listarEquipamentos(),
  ]);
  const opcoes = opcoesDePai(arvore);
  const porId = new Map(categorias.map((c) => [c.id, c]));
  const caminho = (id: string) => {
    const partes: string[] = [];
    for (let c = porId.get(id); c; c = c.paiId ? porId.get(c.paiId) : undefined) partes.unshift(c.nome);
    return partes.join(" › ");
  };
  // Grupos na ordem da árvore de categorias.
  const grupos = opcoes
    .map((o) => ({ id: o.id, titulo: caminho(o.id), itens: equipamentos.filter((e) => e.categoriaId === o.id) }))
    .filter((g) => g.itens.length > 0);

  return (
    <>
      <CabecalhoDePagina
        titulo="Equipamentos e modelos"
        descricao="Cadastre equipamentos, os campos técnicos de cada um e os modelos com seus valores."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6" role="region" aria-label="Lista de equipamentos">
          {grupos.length === 0 && (
            <Card className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-gray-500">
              <Package className="size-6 text-gray-300" />
              Nenhum equipamento cadastrado.
            </Card>
          )}
          {grupos.map((g) => (
            <section key={g.id}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">{g.titulo}</h2>
              <Card className="overflow-hidden">
                {g.itens.map((e, i) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50/60"
                  >
                    <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                      {e.imagemUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={e.imagemUrl} alt="" className="size-full object-cover" />
                      ) : (
                        <ImageOff className="size-4 text-gray-300" />
                      )}
                    </div>
                    <Link href={`/admin/equipamentos/${e.id}`} className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={e.ativo ? "font-medium text-grafite-800" : "text-gray-400 line-through"}>
                          {e.nome}
                        </span>
                        {!e.ativo && <Badge>Inativo</Badge>}
                        {e.isDemo && <Badge tom="demo">DEMO</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">
                        {e.codigo} · {ROTULO_TIPO_EQUIPAMENTO[e.tipo]} · {e._count.modelos}{" "}
                        {e._count.modelos === 1 ? "modelo" : "modelos"} · {e._count.definicoes}{" "}
                        {e._count.definicoes === 1 ? "campo técnico" : "campos técnicos"}
                      </p>
                    </Link>
                    <AcoesDoEquipamento
                      id={e.id}
                      nome={e.nome}
                      ativo={e.ativo}
                      primeira={i === 0}
                      ultima={i === g.itens.length - 1}
                    />
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Novo equipamento</h2>
          <FormEquipamento acao={criarEquipamento} categorias={opcoes} rotuloBotao="Criar equipamento" />
        </Card>
      </div>
    </>
  );
}
