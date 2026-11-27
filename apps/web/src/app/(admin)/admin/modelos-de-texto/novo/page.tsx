import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { carregarDono, lerDono } from "@/features/regras/dados";
import { ROTULO_DONO } from "@/features/regras/schema";
import { salvarModeloDeTexto } from "@/features/modelos-de-texto/actions";
import { EditorDeModeloDeTexto } from "@/features/modelos-de-texto/editor";
import { MODELO_DE_TEXTO_VAZIO } from "@/features/modelos-de-texto/schema";
import { CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Novo modelo de texto" };

export default async function PaginaNovoModeloDeTexto({ searchParams }: PageProps<"/admin/modelos-de-texto/novo">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const { ref } = await searchParams;
  const [tipo, id] = String(ref ?? "").split(":");
  const dono = lerDono(tipo, id);
  if (!dono) notFound();
  const ctx = await carregarDono(dono);
  if (!ctx) notFound();
  return (
    <>
      <Link href="/admin/modelos-de-texto" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Modelos de texto
      </Link>
      <CabecalhoDePagina titulo="Novo modelo de texto" descricao={`${ROTULO_DONO[dono.tipo]} · ${ctx.rotulo}`} />
      <Card className="max-w-4xl p-6">
        <EditorDeModeloDeTexto inicial={MODELO_DE_TEXTO_VAZIO} dono={dono.tipo} comuns={ctx.comuns} salvar={salvarModeloDeTexto.bind(null, dono, null)} />
      </Card>
    </>
  );
}
