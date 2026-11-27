import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { salvarServico } from "@/features/precos/actions";
import { AcoesDoServico, FormServico } from "@/features/precos/formularios";
import { dinheiro } from "@/features/precos/formato";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Serviços" };

export default async function PaginaDeServicos() {
  await exigirPermissaoNaPagina("precos:gerenciar");
  const servicos = await db.servico.findMany({ orderBy: { codigo: "asc" } });
  return (
    <>
      <CabecalhoDePagina
        titulo="Serviços"
        descricao="Montagem, programação, deslocamento… Entram no orçamento por regra (estágio de serviços) ou à mão. O valor é sempre venda fixa."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_28rem]">
        <Card className="overflow-hidden" role="region" aria-label="Lista de serviços">
          {servicos.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-500">Nenhum serviço cadastrado.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {servicos.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3" data-servico={s.codigo}>
                  <div className="min-w-0 flex-1">
                    <Link href={`/admin/servicos/${s.id}`} className="font-medium text-grafite-900 hover:text-marca-700">
                      {s.descricao}
                    </Link>
                    <p className="text-xs text-gray-500">
                      <span className="font-mono">{s.codigo}</span> · {s.valor ? `${dinheiro(s.valor.toString())} / ${s.unidade}` : "sem preço"}
                    </p>
                  </div>
                  {!s.valor && <Badge tom="aviso">Sem preço</Badge>}
                  {!s.ativo && <Badge>Inativo</Badge>}
                  {s.isDemo && <Badge tom="demo">DEMO</Badge>}
                  <AcoesDoServico id={s.id} nome={s.codigo} ativo={s.ativo} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="h-fit p-5">
          <h2 className="mb-4 font-medium text-grafite-900">Novo serviço</h2>
          <FormServico acao={salvarServico.bind(null, null)} />
        </Card>
      </div>
    </>
  );
}
