import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { pode } from "@/server/auth/permissions";
import { precoUnitarioDeVenda } from "@zanatta/engine";
import { criarPrecoDoItem } from "@/features/precos/actions";
import { carregarPrecosVigentes, lerRegraComercial } from "@/features/precos/dados";
import { ExcluirPreco, FormNovoPreco } from "@/features/precos/formularios";
import { dataBR, dinheiro, hojeEmBrasilia } from "@/features/precos/formato";
import { MODO_DO_BANCO, ROTULO_MODO } from "@/features/precos/schema";
import { salvarItem } from "@/features/componentes/actions";
import { AcoesDoItem, FormItem } from "@/features/componentes/formularios";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Item do catálogo" };

export default async function PaginaDoItem({ params }: PageProps<"/admin/componentes/[id]">) {
  const usuario = await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const verPrecos = pode(usuario.perfil, "precos:gerenciar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [item, categorias, modelos, regras] = await Promise.all([
    db.itemDeCatalogo.findUnique({ where: { id } }),
    db.categoriaDeComponente.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }] }),
    db.modelo.findMany({ where: { itemId: id }, select: { id: true, nome: true, equipamento: { select: { id: true, nome: true } } } }),
    db.regra.findMany({ where: { efeitos: { string_contains: id } }, select: { id: true, codigo: true, nome: true } }),
  ]);
  const [historico, vigentes, regra] = verPrecos
    ? await Promise.all([db.precoDoItem.findMany({ where: { itemId: id }, orderBy: [{ vigenteDesde: "desc" }, { criadoEm: "desc" }] }), carregarPrecosVigentes(), lerRegraComercial()])
    : [[], {}, null];
  const vigente = (vigentes as Awaited<ReturnType<typeof carregarPrecosVigentes>>)[id];
  const vendaVigente = precoUnitarioDeVenda(vigente, regra);
  const agora = new Date();
  const idVigente = historico.find((p) => p.vigenteDesde <= agora)?.id;
  if (!item) notFound();
  return (
    <>
      <Link href="/admin/componentes" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Componentes
      </Link>
      <CabecalhoDePagina
        titulo={item.descricao}
        descricao={item.codigo}
        acoes={
          <div className="flex items-center gap-2">
            {!item.ativo && <Badge>Inativo</Badge>}
            {item.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDoItem id={item.id} nome={item.codigo} ativo={item.ativo} />
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="p-6">
          <FormItem acao={salvarItem.bind(null, item.id)} categorias={categorias} inicial={item} />
        </Card>
        {verPrecos && (
          <Card className="p-6 xl:col-start-1" role="region" aria-label="Preços do item">
            <h2 className="mb-1 font-medium text-grafite-900">Preços</h2>
            <p className="mb-4 text-sm text-gray-600" data-campo="venda-vigente">
              {vendaVigente
                ? `Venda vigente: ${dinheiro(vendaVigente.toFixed(2))} por ${item.unidade} (${ROTULO_MODO[vigente!.modo].toLowerCase()}).`
                : vigente
                  ? "Há preço vigente, mas a regra comercial não está configurada."
                  : "Sem preço vigente: orçamentos com este item ficam com total parcial."}
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              <FormNovoPreco acao={criarPrecoDoItem.bind(null, item.id)} hoje={hojeEmBrasilia()} />
              <div>
                <h3 className="mb-2 text-sm font-medium text-grafite-800">Histórico</h3>
                {historico.length === 0 && <p className="text-sm text-gray-500">Nenhum preço registrado.</p>}
                <ul className="divide-y divide-gray-100 text-sm" aria-label="Histórico de preços">
                  {historico.map((p) => (
                    <li key={p.id} className="flex items-center gap-2 py-2" data-preco={p.id}>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-grafite-900">
                          {ROTULO_MODO[MODO_DO_BANCO[p.modo]]}: {p.modo === "VENDA_FIXA" ? `venda ${dinheiro(p.venda?.toString())}` : `custo ${dinheiro(p.custo?.toString())}`}
                          {p.modo === "VENDA_FIXA" && p.custo ? ` · custo ${dinheiro(p.custo.toString())}` : ""}
                        </p>
                        <p className="text-xs text-gray-500">
                          A partir de {dataBR(p.vigenteDesde)} · {p.atualizadoPor ?? "—"}
                          {p.observacao ? ` · ${p.observacao}` : ""}
                        </p>
                      </div>
                      {p.id === idVigente && <Badge tom="marca">Vigente</Badge>}
                      {p.vigenteDesde > agora && <Badge>Futuro</Badge>}
                      {p.isDemo && <Badge tom="demo">DEMO</Badge>}
                      <ExcluirPreco id={p.id} nome={`preço de ${dataBR(p.vigenteDesde)}`} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        )}
        <Card className="h-fit p-5 text-sm xl:col-start-2 xl:row-start-1">
          <h2 className="mb-2 font-medium text-grafite-900">Onde é usado</h2>
          {modelos.length + regras.length === 0 && <p className="text-gray-500">Ainda não é usado por modelos nem regras.</p>}
          <ul className="flex flex-col gap-1">
            {modelos.map((m) => (
              <li key={m.id}>
                <Link className="text-marca-700 hover:underline" href={`/admin/equipamentos/${m.equipamento.id}/modelos/${m.id}`}>
                  Fornecimento de {m.equipamento.nome} › {m.nome}
                </Link>
              </li>
            ))}
            {regras.map((r) => (
              <li key={r.id}>
                <Link className="text-marca-700 hover:underline" href={`/admin/regras/${r.id}`}>
                  Regra {r.codigo}: {r.nome}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
