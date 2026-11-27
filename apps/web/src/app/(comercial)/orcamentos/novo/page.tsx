import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { criarOrcamento } from "@/features/orcamentos/actions";
import { FormDadosBasicos } from "@/features/orcamentos/formulario";
import { CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NovoOrcamento() {
  await exigirPermissaoNaPagina("orcamento:criar");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Orçamentos
      </Link>
      <CabecalhoDePagina titulo="Novo orçamento" descricao="Informe os dados básicos. Em seguida você monta o projeto no configurador." />
      <Card className="p-6">
        <FormDadosBasicos acao={criarOrcamento} rotuloBotao="Criar e configurar" />
      </Card>
    </div>
  );
}
