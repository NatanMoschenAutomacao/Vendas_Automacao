import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { precoUnitarioDeVenda } from "@zanatta/engine";
import { carregarPrecosVigentes, lerRegraComercial } from "@/features/precos/dados";
import { dinheiro, pct } from "@/features/precos/formato";
import { ROTULO_MODO } from "@/features/precos/schema";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Preços" };

export default async function PaginaDePrecos({ searchParams }: PageProps<"/admin/precos">) {
  await exigirPermissaoNaPagina("precos:gerenciar");
  const { filtro } = await searchParams;
  const [itens, precos, regra] = await Promise.all([
    db.itemDeCatalogo.findMany({ where: { ativo: true }, orderBy: { codigo: "asc" }, select: { id: true, codigo: true, descricao: true, unidade: true, isDemo: true, grupoComercial: true } }),
    carregarPrecosVigentes(),
    lerRegraComercial(),
  ]);
  const semPreco = itens.filter((i) => !precoUnitarioDeVenda(precos[i.id], regra));
  const lista = filtro === "sem-preco" ? semPreco : itens;
  return (
    <>
      <CabecalhoDePagina
        titulo="Preços"
        descricao="Preço vigente de cada item ativo do catálogo. Para registrar um novo preço, abra o item; o histórico é mantido."
      />
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-600">
          Regra comercial:{" "}
          <strong>{regra ? `${regra.tipo === "markup" ? "markup" : "margem"} de ${pct(regra.percentual)}` : "não configurada"}</strong>
        </span>
        <Link href="/admin/configuracoes" className="text-marca-700 hover:underline">
          Regra comercial, impostos e limite de desconto
        </Link>
        <Link href="/admin/servicos" className="text-marca-700 hover:underline">
          Serviços
        </Link>
        <span className="ml-auto flex gap-2">
          <Link href="/admin/precos" className={filtro !== "sem-preco" ? "font-medium text-grafite-900" : "text-gray-500"}>
            Todos ({itens.length})
          </Link>
          <Link href="/admin/precos?filtro=sem-preco" className={filtro === "sem-preco" ? "font-medium text-grafite-900" : "text-gray-500"}>
            Sem preço ({semPreco.length})
          </Link>
        </span>
      </div>
      <Card className="overflow-x-auto" role="region" aria-label="Preços vigentes">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Item</th>
              <th className="px-4 py-2">Modo</th>
              <th className="px-4 py-2 text-right">Custo</th>
              <th className="px-4 py-2 text-right">Venda unitária</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lista.map((i) => {
              const p = precos[i.id];
              const venda = precoUnitarioDeVenda(p, regra);
              return (
                <tr key={i.id} data-codigo={i.codigo}>
                  <td className="px-4 py-2">
                    <Link href={`/admin/componentes/${i.id}`} className="font-medium text-grafite-900 hover:text-marca-700">
                      {i.descricao}
                    </Link>
                    <span className="ml-2 font-mono text-xs text-gray-500">{i.codigo}</span>
                    {i.grupoComercial === "SOFTWARE" && <Badge className="ml-2">Software</Badge>}
                    {i.isDemo && <Badge tom="demo" className="ml-2">DEMO</Badge>}
                  </td>
                  <td className="px-4 py-2 text-gray-600">{p ? ROTULO_MODO[p.modo] : "—"}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{dinheiro(p?.custo)}</td>
                  <td className="px-4 py-2 text-right tabular-nums" data-campo="venda">
                    {venda ? `${dinheiro(venda.toFixed(2))} / ${i.unidade}` : <Badge tom="aviso">Sem preço</Badge>}
                  </td>
                </tr>
              );
            })}
            {lista.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-gray-500">
                  Nenhum item.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
