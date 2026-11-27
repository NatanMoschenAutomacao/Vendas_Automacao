import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Condicao } from "@zanatta/engine";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { carregarDono, donoDoBanco } from "@/features/regras/dados";
import { ROTULO_DONO } from "@/features/regras/schema";
import { salvarModeloDeTexto } from "@/features/modelos-de-texto/actions";
import { AcoesDoModeloDeTexto, EditorDeModeloDeTexto } from "@/features/modelos-de-texto/editor";
import type { DadosDoModeloDeTexto } from "@/features/modelos-de-texto/schema";
import { Badge, CabecalhoDePagina, Card, Mensagem } from "@/ui/card";

export const metadata: Metadata = { title: "Modelo de texto" };

export default async function PaginaDoModeloDeTexto({ params, searchParams }: PageProps<"/admin/modelos-de-texto/[id]">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const { id } = await params;
  const { criado } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const m = await db.modeloDeTexto.findUnique({ where: { id } });
  if (!m) notFound();
  const dono = donoDoBanco(m);
  const ctx = await carregarDono(dono);
  if (!ctx) notFound();
  const inicial: DadosDoModeloDeTexto = {
    secao: m.secao as DadosDoModeloDeTexto["secao"],
    texto: m.texto,
    condicao: (m.condicao ?? null) as Condicao | null,
    ordem: m.ordem,
    ativo: m.ativo,
    isDemo: m.isDemo,
  };
  return (
    <>
      <Link href="/admin/modelos-de-texto" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Modelos de texto
      </Link>
      <CabecalhoDePagina
        titulo="Modelo de texto"
        descricao={`${ROTULO_DONO[dono.tipo]} · ${ctx.rotulo}`}
        acoes={
          <div className="flex items-center gap-2">
            {!m.ativo && <Badge>Inativo</Badge>}
            {m.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDoModeloDeTexto id={m.id} nome="este trecho" ativo={m.ativo} voltar="/admin/modelos-de-texto" />
          </div>
        }
      />
      {criado && (
        <div className="mb-4 max-w-4xl">
          <Mensagem tipo="sucesso">Modelo de texto criado.</Mensagem>
        </div>
      )}
      <Card className="max-w-4xl p-6">
        <EditorDeModeloDeTexto inicial={inicial} dono={dono.tipo} comuns={ctx.comuns} salvar={salvarModeloDeTexto.bind(null, null, m.id)} />
      </Card>
    </>
  );
}
