import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { obterOrcamento } from "@/features/orcamentos/queries";
import { salvarDadosBasicos } from "@/features/orcamentos/actions";
import { FormDadosBasicos } from "@/features/orcamentos/formulario";
import { CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Dados básicos" };

export default async function DadosDoOrcamento({ params }: PageProps<"/orcamentos/[id]/dados">) {
  await exigirPermissaoNaPagina("orcamento:criar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const o = await obterOrcamento(id);
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/orcamentos/${o.id}`} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Voltar ao configurador
      </Link>
      <CabecalhoDePagina titulo="Dados básicos" descricao={`Orçamento ${o.numero}`} />
      <Card className="p-6">
        <FormDadosBasicos acao={salvarDadosBasicos.bind(null, o.id)} inicial={o} rotuloBotao="Salvar dados" />
      </Card>
    </div>
  );
}
