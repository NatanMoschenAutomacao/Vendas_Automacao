import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { urlDaImagem } from "@/server/arquivos/armazenamento";
import { listarArvoreDeCategorias } from "@/features/categorias/queries";
import { opcoesDePai } from "@/features/categorias/opcoes-de-pai";
import { atualizarImagemInterativa, salvarHotspots } from "@/features/imagens-interativas/actions";
import { AcoesDaImagemInterativa, FormImagemInterativa } from "@/features/imagens-interativas/formulario";
import { EditorDeHotspots } from "@/features/imagens-interativas/editor";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Imagem interativa" };

export default async function PaginaDaImagemInterativa({ params }: PageProps<"/admin/imagens-interativas/[id]">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const ii = await db.imagemInterativa.findUnique({
    where: { id },
    include: { imagem: true, hotspots: { orderBy: { ordem: "asc" } }, categoria: true, equipamento: true },
  });
  if (!ii) notFound();
  const [{ arvore }, equipamentos, modelos, kits, perguntas] = await Promise.all([
    listarArvoreDeCategorias(),
    db.equipamento.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    db.modelo.findMany({
      where: { ativo: true, equipamento: { ativo: true } },
      orderBy: [{ equipamento: { nome: "asc" } }, { ordem: "asc" }],
      select: { id: true, nome: true, equipamento: { select: { nome: true } } },
    }),
    db.kit.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { id: true, nome: true } }),
    ii.equipamentoId
      ? db.pergunta.findMany({
          where: { ativo: true, OR: [{ equipamentoId: ii.equipamentoId }, { modelo: { equipamentoId: ii.equipamentoId } }] },
          orderBy: [{ ordem: "asc" }, { chave: "asc" }],
          select: { chave: true, texto: true, opcoes: true, modo: true },
        })
      : Promise.resolve(null),
  ]);
  // Uma chave pode aparecer no equipamento e em modelos (substituição): junta as opções.
  const porChave = new Map<string, { chave: string; texto: string; opcoes: { valor: string; rotulo: string }[] }>();
  for (const p of perguntas ?? []) {
    if (p.modo === "OCULTAR") continue;
    const atual = porChave.get(p.chave) ?? { chave: p.chave, texto: p.texto, opcoes: [] };
    for (const o of (Array.isArray(p.opcoes) ? p.opcoes : []) as { valor: string; rotulo: string }[])
      if (!atual.opcoes.some((x) => x.valor === o.valor)) atual.opcoes.push({ valor: o.valor, rotulo: o.rotulo });
    porChave.set(p.chave, atual);
  }

  return (
    <>
      <Link href="/admin/imagens-interativas" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Imagens interativas
      </Link>
      <CabecalhoDePagina
        titulo={ii.nome}
        descricao={ii.categoria ? `Aparece no catálogo em ${ii.categoria.nome}` : `Aparece no painel de ${ii.equipamento?.nome}`}
        acoes={
          <div className="flex items-center gap-2">
            {!ii.ativo && <Badge>Inativa</Badge>}
            {ii.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDaImagemInterativa id={ii.id} nome={ii.nome} ativo={ii.ativo} noCabecalho />
          </div>
        }
      />
      <div className="flex flex-col gap-6">
        <Card className="p-5">
          <EditorDeHotspots
            url={urlDaImagem(ii.imagem.chave)!}
            nome={ii.imagem.textoAlternativo ?? ii.nome}
            largura={ii.imagem.largura}
            altura={ii.imagem.altura}
            salvar={salvarHotspots.bind(null, ii.id)}
            inicial={ii.hotspots.map((h) => ({
              rotulo: h.rotulo,
              forma: h.forma,
              x: h.x,
              y: h.y,
              largura: h.largura,
              altura: h.altura,
              alvoTipo: h.alvoTipo,
              alvoId: h.alvoId,
              alvoValor: h.alvoValor,
            }))}
            alvos={{
              equipamentos,
              modelos: modelos.map((m) => ({ id: m.id, nome: m.nome, equipamento: m.equipamento.nome })),
              kits,
              perguntas: perguntas ? [...porChave.values()] : null,
            }}
          />
        </Card>
        <Card className="max-w-3xl p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Dados da imagem</h2>
          <FormImagemInterativa
            acao={atualizarImagemInterativa.bind(null, ii.id)}
            categorias={opcoesDePai(arvore)}
            equipamentos={equipamentos}
            inicial={{ nome: ii.nome, dono: ii.categoriaId ? `categoria:${ii.categoriaId}` : `equipamento:${ii.equipamentoId}`, isDemo: ii.isDemo }}
            rotuloBotao="Salvar"
          />
        </Card>
      </div>
    </>
  );
}
