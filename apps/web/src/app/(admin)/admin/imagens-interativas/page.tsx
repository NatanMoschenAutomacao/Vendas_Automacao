import type { Metadata } from "next";
import Link from "next/link";
import { MousePointerClick } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { urlDaImagem } from "@/server/arquivos/armazenamento";
import { listarArvoreDeCategorias } from "@/features/categorias/queries";
import { opcoesDePai } from "@/features/categorias/opcoes-de-pai";
import { criarImagemInterativa } from "@/features/imagens-interativas/actions";
import { AcoesDaImagemInterativa, FormImagemInterativa } from "@/features/imagens-interativas/formulario";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Imagens interativas" };

export default async function PaginaDeImagensInterativas() {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const [{ arvore }, equipamentos, imagens] = await Promise.all([
    listarArvoreDeCategorias(),
    db.equipamento.findMany({ orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.imagemInterativa.findMany({
      orderBy: { nome: "asc" },
      include: {
        imagem: { select: { chave: true } },
        categoria: { select: { nome: true } },
        equipamento: { select: { nome: true } },
        _count: { select: { hotspots: true } },
      },
    }),
  ]);
  return (
    <>
      <CabecalhoDePagina
        titulo="Imagens interativas"
        descricao="Imagens com áreas clicáveis que adicionam equipamentos, escolhem modelos, aplicam kits ou respondem perguntas."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="h-fit overflow-hidden" role="region" aria-label="Lista de imagens interativas">
          {imagens.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-sm text-gray-500">
              <MousePointerClick className="size-6 text-gray-300" />
              Nenhuma imagem interativa cadastrada.
            </div>
          )}
          {imagens.map((i) => (
            <div key={i.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50/60">
              <div className="h-12 w-16 shrink-0 overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urlDaImagem(i.imagem.chave)!} alt="" className="size-full object-cover" />
              </div>
              <Link href={`/admin/imagens-interativas/${i.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={i.ativo ? "font-medium text-grafite-800" : "text-gray-400 line-through"}>{i.nome}</span>
                  {!i.ativo && <Badge>Inativa</Badge>}
                  {i.isDemo && <Badge tom="demo">DEMO</Badge>}
                </div>
                <p className="text-xs text-gray-500">
                  {i.categoria ? `Sistema: ${i.categoria.nome}` : `Equipamento: ${i.equipamento?.nome}`} · {i._count.hotspots}{" "}
                  {i._count.hotspots === 1 ? "área" : "áreas"}
                </p>
              </Link>
              <AcoesDaImagemInterativa id={i.id} nome={i.nome} ativo={i.ativo} />
            </div>
          ))}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Nova imagem interativa</h2>
          <FormImagemInterativa acao={criarImagemInterativa} categorias={opcoesDePai(arvore)} equipamentos={equipamentos} rotuloBotao="Enviar e editar áreas" />
        </Card>
      </div>
    </>
  );
}
