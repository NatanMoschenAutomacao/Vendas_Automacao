import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { urlDaImagem } from "@/server/arquivos/armazenamento";
import { listarArvoreDeCategorias } from "@/features/categorias/queries";
import { opcoesDePai } from "@/features/categorias/opcoes-de-pai";
import { atualizarKit, enviarImagemDoKit, removerImagemDoKit, salvarItensDoKit } from "@/features/kits/actions";
import { EditorDeItensDoKit, FormKit } from "@/features/kits/formularios";
import { AcoesDoKit } from "@/features/kits/acoes";
import { FormImagem } from "@/features/equipamentos/formularios";
import { paraPergunta, paraPerguntaDeModelo } from "@/features/perguntas/conversao";
import type { ValorDeResposta } from "@zanatta/engine";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Kit" };

export default async function PaginaDoKit({ params }: PageProps<"/admin/kits/[id]">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [kit, { arvore }, equipamentos] = await Promise.all([
    db.kit.findUnique({ where: { id }, include: { imagem: true, itens: { orderBy: { ordem: "asc" } } } }),
    listarArvoreDeCategorias(),
    db.equipamento.findMany({
      orderBy: { nome: "asc" },
      include: {
        perguntas: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { chave: "asc" }] },
        modelos: {
          orderBy: [{ ordem: "asc" }, { nome: "asc" }],
          include: { perguntas: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { chave: "asc" }] } },
        },
      },
    }),
  ]);
  if (!kit) notFound();
  return (
    <>
      <Link href="/admin/kits" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Kits
      </Link>
      <CabecalhoDePagina
        titulo={kit.nome}
        descricao="Itens pré-selecionados, com quantidade e respostas padrão."
        acoes={
          <div className="flex items-center gap-2">
            {!kit.ativo && <Badge>Inativo</Badge>}
            {kit.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDoKit id={kit.id} nome={kit.nome} ativo={kit.ativo} noCabecalho />
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Itens</h2>
          <EditorDeItensDoKit
            salvar={salvarItensDoKit.bind(null, kit.id)}
            inicial={kit.itens.map((i) => ({
              equipamentoId: i.equipamentoId,
              modeloId: i.modeloId,
              quantidade: i.quantidade,
              respostas: (i.respostas ?? {}) as Record<string, ValorDeResposta | null>,
            }))}
            equipamentos={equipamentos.map((e) => ({
              id: e.id,
              nome: e.nome,
              ativo: e.ativo,
              perguntas: e.perguntas.map(paraPergunta),
              modelos: e.modelos.map((m) => ({ id: m.id, nome: m.nome, ativo: m.ativo, perguntas: m.perguntas.map(paraPerguntaDeModelo) })),
            }))}
          />
        </Card>
        <div className="flex flex-col gap-6">
          <Card className="p-5">
            <h2 className="mb-4 font-medium text-grafite-900">Dados do kit</h2>
            <FormKit acao={atualizarKit.bind(null, kit.id)} categorias={opcoesDePai(arvore)} inicial={kit} rotuloBotao="Salvar kit" />
          </Card>
          <Card className="p-5">
            <h2 className="mb-4 font-medium text-grafite-900">Imagem do card</h2>
            <FormImagem
              acao={enviarImagemDoKit.bind(null, kit.id)}
              remover={removerImagemDoKit.bind(null, kit.id)}
              url={urlDaImagem(kit.imagem?.chave)}
              textoAlternativo={kit.imagem?.textoAlternativo}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
