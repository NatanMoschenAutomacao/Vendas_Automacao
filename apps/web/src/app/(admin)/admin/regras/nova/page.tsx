import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { salvarRegra } from "@/features/regras/actions";
import { carregarDono, carregarOpcoesDoEditor, lerDono } from "@/features/regras/dados";
import { EditorDeRegra } from "@/features/regras/editor";
import { CabecalhoDePagina, Card } from "@/ui/card";
import { REGRA_VAZIA, ROTULO_DONO } from "@/features/regras/schema";

export const metadata: Metadata = { title: "Nova regra" };

export default async function PaginaNovaRegra({ searchParams }: PageProps<"/admin/regras/nova">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const sp = await searchParams;
  const dono = lerDono(sp.dono, sp.id);
  if (!dono) notFound();
  const [ctx, opcoes] = await Promise.all([carregarDono(dono), carregarOpcoesDoEditor()]);
  if (!ctx) notFound();
  const estagio = sp.estagio === "recurso" ? "recurso" : sp.estagio === "servico" ? "servico" : "material";
  return (
    <>
      <Link href={ctx.voltar} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <CabecalhoDePagina titulo="Nova regra" descricao={`${ROTULO_DONO[dono.tipo]} · ${ctx.rotulo}`} />
      <Card className="max-w-5xl p-6">
        <EditorDeRegra
          inicial={{ ...REGRA_VAZIA, estagio }}
          dono={dono.tipo}
          comuns={ctx.comuns}
          itens={opcoes.itens}
          recursos={opcoes.recursos}
          servicos={opcoes.servicos}
          salvar={salvarRegra.bind(null, dono, null)}
        />
      </Card>
    </>
  );
}
