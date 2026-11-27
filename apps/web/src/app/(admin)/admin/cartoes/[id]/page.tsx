import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { salvarCartao, salvarControladoresDoCartao, salvarRecursosDoCartao } from "@/features/cartoes/actions";
import { AcoesDoCartao, FormCartao, FormControladoresDoCartao } from "@/features/cartoes/formularios";
import { EditorDeRecursosIntegrados } from "@/features/controladores/formularios";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Cartão de expansão" };

export default async function PaginaDoCartao({ params }: PageProps<"/admin/cartoes/[id]">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c, tipos, controladores] = await Promise.all([
    db.cartaoDeExpansao.findUnique({
      where: { id },
      include: { item: { select: { id: true, codigo: true, descricao: true } }, recursos: true, controladores: { select: { id: true } } },
    }),
    db.tipoDeRecurso.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { codigo: "asc" }], select: { id: true, codigo: true, nome: true } }),
    db.controlador.findMany({ orderBy: { item: { codigo: "asc" } }, select: { id: true, barramento: true, item: { select: { codigo: true, descricao: true } } } }),
  ]);
  if (!c) notFound();
  return (
    <>
      <Link href="/admin/cartoes" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Cartões de expansão
      </Link>
      <CabecalhoDePagina
        titulo={c.item.descricao}
        descricao={c.item.codigo}
        acoes={
          <div className="flex items-center gap-2">
            {!c.ativo && <Badge>Inativo</Badge>}
            {c.isDemo && <Badge tom="demo">DEMO</Badge>}
            <Link href={`/admin/componentes/${c.item.id}`} className="text-sm text-marca-700 hover:underline">
              Item do catálogo
            </Link>
            <AcoesDoCartao id={c.id} nome={c.item.descricao} ativo={c.ativo} noCabecalho />
          </div>
        }
      />
      <div className="grid items-start gap-6 2xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Dados técnicos</h2>
          <FormCartao acao={salvarCartao.bind(null, c.id)} inicial={c} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-medium text-grafite-900">Pontos do cartão</h2>
          <p className="mb-4 text-sm text-gray-500">Cartões mistos têm mais de um tipo.</p>
          <EditorDeRecursosIntegrados
            tipos={tipos}
            inicial={Object.fromEntries(c.recursos.map((r) => [r.tipoRecursoId, r.quantidade]))}
            salvar={salvarRecursosDoCartao.bind(null, c.id)}
            sufixo="no cartão"
            rotulo="Pontos do cartão"
          />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Controladores compatíveis</h2>
          <FormControladoresDoCartao
            acao={salvarControladoresDoCartao.bind(null, c.id)}
            controladores={controladores.map((x) => ({ id: x.id, codigo: x.item.codigo, descricao: x.item.descricao, barramento: x.barramento }))}
            marcados={c.controladores.map((x) => x.id)}
          />
        </Card>
      </div>
    </>
  );
}
