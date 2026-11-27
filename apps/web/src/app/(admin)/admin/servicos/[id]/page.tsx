import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { salvarServico } from "@/features/precos/actions";
import { AcoesDoServico, FormServico } from "@/features/precos/formularios";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Serviço" };

export default async function PaginaDoServico({ params }: PageProps<"/admin/servicos/[id]">) {
  await exigirPermissaoNaPagina("precos:gerenciar");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [s, regras] = await Promise.all([
    db.servico.findUnique({ where: { id } }),
    db.regra.findMany({ where: { efeitos: { string_contains: id } }, select: { id: true, codigo: true, nome: true } }),
  ]);
  if (!s) notFound();
  return (
    <>
      <Link href="/admin/servicos" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Serviços
      </Link>
      <CabecalhoDePagina
        titulo={s.descricao}
        descricao={s.codigo}
        acoes={
          <div className="flex items-center gap-2">
            {!s.ativo && <Badge>Inativo</Badge>}
            {s.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDoServico id={s.id} nome={s.codigo} ativo={s.ativo} voltar="/admin/servicos" />
          </div>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="p-6">
          <FormServico
            acao={salvarServico.bind(null, s.id)}
            inicial={{ ...s, valor: s.valor?.toString() ?? null, custo: s.custo?.toString() ?? null }}
          />
        </Card>
        <Card className="h-fit p-5 text-sm">
          <h2 className="mb-2 font-medium text-grafite-900">Regras que incluem este serviço</h2>
          {regras.length === 0 && <p className="text-gray-500">Nenhuma regra. Crie uma regra de estágio &quot;Serviços&quot; em Regras de composição.</p>}
          <ul className="flex flex-col gap-1">
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
