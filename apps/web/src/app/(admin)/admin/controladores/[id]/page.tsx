import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import {
  salvarControlador,
  salvarModelosCompativeis,
  salvarRecursosDoControlador,
  salvarSaidasDoControlador,
} from "@/features/controladores/actions";
import {
  AcoesDoControlador,
  EditorDeRecursosIntegrados,
  EditorDeSaidas,
  FormControlador,
  FormModelosCompativeis,
} from "@/features/controladores/formularios";
import { ROTULO_TIPO } from "@/features/controladores/schema";
import { ListaDeRegras } from "@/features/regras/lista";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Controlador" };

export default async function PaginaDoControlador({ params }: PageProps<"/admin/controladores/[id]">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c, tipos, funcoes, equipamentos] = await Promise.all([
    db.controlador.findUnique({
      where: { id },
      include: {
        item: { select: { id: true, codigo: true, descricao: true } },
        recursos: true,
        saidas: { orderBy: { ordem: "asc" }, include: { funcoes: { select: { id: true } } } },
        modelosCompativeis: { select: { id: true } },
        cartoesCompativeis: { select: { id: true, ativo: true, item: { select: { codigo: true, descricao: true } } } },
        regras: { orderBy: [{ prioridade: "asc" }, { codigo: "asc" }] },
      },
    }),
    db.tipoDeRecurso.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { codigo: "asc" }], select: { id: true, codigo: true, nome: true } }),
    db.funcaoDeControle.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true } }),
    db.equipamento.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, modelos: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true, codigo: true } } },
    }),
  ]);
  if (!c) notFound();
  return (
    <>
      <Link href="/admin/controladores" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Controladores
      </Link>
      <CabecalhoDePagina
        titulo={c.item.descricao}
        descricao={`${c.item.codigo} · ${ROTULO_TIPO[c.tipo]}`}
        acoes={
          <div className="flex items-center gap-2">
            {!c.ativo && <Badge>Inativo</Badge>}
            {c.isDemo && <Badge tom="demo">DEMO</Badge>}
            <Link href={`/admin/componentes/${c.item.id}`} className="text-sm text-marca-700 hover:underline">
              Item do catálogo
            </Link>
            <AcoesDoControlador id={c.id} nome={c.item.descricao} ativo={c.ativo} noCabecalho />
          </div>
        }
      />
      <div className="grid items-start gap-6 2xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Dados técnicos</h2>
          <FormControlador acao={salvarControlador.bind(null, c.id)} inicial={c} />
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-medium text-grafite-900">Recursos integrados</h2>
          <p className="mb-4 text-sm text-gray-500">Pontos de I/O e comunicação que já vêm no controlador, sem cartões de expansão.</p>
          <EditorDeRecursosIntegrados
            tipos={tipos}
            inicial={Object.fromEntries(c.recursos.map((r) => [r.tipoRecursoId, r.quantidade]))}
            salvar={salvarRecursosDoControlador.bind(null, c.id)}
          />
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-medium text-grafite-900">Saídas funcionais</h2>
          <p className="mb-4 text-sm text-gray-500">Cada grupo de controle do projeto ocupa uma saída que suporte a função dele.</p>
          <EditorDeSaidas
            funcoes={funcoes}
            inicial={c.saidas.map((s) => ({ id: s.id, codigo: s.codigo, descricao: s.descricao, funcoes: s.funcoes.map((f) => f.id) }))}
            salvar={salvarSaidasDoControlador.bind(null, c.id)}
          />
        </Card>
        <Card className="p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Modelos compatíveis</h2>
          <FormModelosCompativeis
            acao={salvarModelosCompativeis.bind(null, c.id)}
            equipamentos={equipamentos.filter((e) => e.modelos.length > 0)}
            marcados={c.modelosCompativeis.map((m) => m.id)}
          />
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 font-medium text-grafite-900">Cartões compatíveis</h2>
          <p className="mb-3 text-sm text-gray-500">Marque a compatibilidade na página de cada cartão.</p>
          {c.cartoesCompativeis.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum cartão compatível.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {c.cartoesCompativeis.map((k) => (
                <Link key={k.id} href={`/admin/cartoes/${k.id}`} className="rounded-md bg-gray-50 px-2 py-1 text-sm hover:bg-gray-100">
                  {k.item.descricao} <span className="font-mono text-xs text-gray-500">{k.item.codigo}</span>
                  {!k.ativo && " (inativo)"}
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
      <section className="mt-8 flex max-w-5xl flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-medium text-grafite-900">Regras de material do controlador</h2>
            <p className="text-sm text-gray-500">Ex.: relés de interface ou fonte que acompanham este controlador. Base: por controlador.</p>
          </div>
          <Link
            href={`/admin/regras/nova?dono=controlador&id=${c.id}`}
            className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50"
          >
            Nova regra do controlador
          </Link>
        </div>
        <Card className="overflow-hidden">
          <ListaDeRegras regras={c.regras} vazio="Sem regras." rotulo="Regras do controlador" />
        </Card>
      </section>
    </>
  );
}
