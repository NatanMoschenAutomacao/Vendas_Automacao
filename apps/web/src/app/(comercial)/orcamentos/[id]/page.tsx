import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { pode } from "@/server/auth/permissions";
import { obterOrcamento } from "@/features/orcamentos/queries";
import { ROTULO_STATUS } from "@/features/orcamentos/schema";
import { AcoesDoOrcamento } from "@/features/orcamentos/acoes";
import { carregarBibliotecaDoConfigurador } from "@/features/configurador/biblioteca";
import { Configurador } from "@/features/configurador/configurador";
import { lerLimiteDeDesconto } from "@/features/precos/dados";
import { dataBR } from "@/features/precos/formato";
import { SituacaoDoOrcamento } from "@/features/orcamentos/situacao";
import { Badge, CabecalhoDePagina } from "@/ui/card";

export const metadata: Metadata = { title: "Configurador" };

export default async function PaginaDoConfigurador({ params }: PageProps<"/orcamentos/[id]">) {
  const usuario = await exigirPermissaoNaPagina("orcamento:ver");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const descontoLivre = pode(usuario.perfil, "precos:desconto-livre");
  const [o, biblioteca, limite] = await Promise.all([
    obterOrcamento(id),
    carregarBibliotecaDoConfigurador({ verCusto: pode(usuario.perfil, "precos:ver-custo") }),
    lerLimiteDeDesconto(),
  ]);
  if (!o) notFound();
  const editavel = o.status === "RASCUNHO";
  return (
    <>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Orçamentos
      </Link>
      <CabecalhoDePagina
        titulo={`${o.cliente} · ${o.projeto}`}
        descricao={`Orçamento ${o.numero}${o.cidade ? ` · ${o.cidade}${o.uf ? `/${o.uf}` : ""}` : ""} · ${o.vendedor.nome}`}
        acoes={
          <div className="flex items-center gap-2">
            <Badge>{ROTULO_STATUS[o.status]}</Badge>
            {editavel && (
              <>
                <Link
                  href={`/orcamentos/${o.id}/dados`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-grafite-800 hover:bg-gray-50"
                >
                  <Pencil className="size-3.5" /> Dados básicos
                </Link>
                <AcoesDoOrcamento id={o.id} numero={o.numero} voltarAoExcluir />
              </>
            )}
          </div>
        }
      />
      <SituacaoDoOrcamento
        id={o.id}
        status={o.status}
        revisao={o.revisao?.numero ?? 1}
        emitidoEm={o.revisao?.emissao ? dataBR(o.revisao.emissao.emitidoEm) : null}
        podeValidar={pode(usuario.perfil, "orcamento:validar")}
        verCusto={pode(usuario.perfil, "precos:ver-custo")}
      />
      <Configurador
        orcamentoId={o.id}
        editavel={editavel}
        podeAjustarReserva={pode(usuario.perfil, "configuracoes:gerenciar")}
        comercial={{ descontoLivre, limiteDeDesconto: limite.percentual }}
        biblioteca={biblioteca}
        inicial={o.configuracao}
        salvoEm={o.revisao?.salvoEm.toISOString() ?? null}
      />
    </>
  );
}
