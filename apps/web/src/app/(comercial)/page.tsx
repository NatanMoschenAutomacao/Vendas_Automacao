import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { pode } from "@/server/auth/permissions";
import { listarOrcamentos } from "@/features/orcamentos/queries";
import { ROTULO_STATUS } from "@/features/orcamentos/schema";
import { AcoesDoOrcamento } from "@/features/orcamentos/acoes";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default async function TelaInicial() {
  const u = await exigirPermissaoNaPagina("orcamento:ver");
  const orcamentos = await listarOrcamentos();
  const verTodos = pode(u.perfil, "orcamento:ver-todos");
  return (
    <>
      <CabecalhoDePagina
        titulo={`Olá, ${u.nome.split(" ")[0]}`}
        descricao="Monte visualmente a solução do cliente; o sistema calcula materiais e valores."
        acoes={
          pode(u.perfil, "orcamento:criar") && (
            <Link
              href="/orcamentos/novo"
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-marca-600 px-4 text-sm font-medium text-white hover:bg-marca-700"
            >
              <Plus className="size-4" /> Novo orçamento
            </Link>
          )
        }
      />
      {orcamentos.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-gray-50 text-gray-400">
            <FileText className="size-6" />
          </span>
          <h2 className="font-medium text-grafite-800">Nenhum orçamento ainda</h2>
          <p className="max-w-md text-sm text-gray-500">Clique em “Novo orçamento” para informar os dados do cliente e montar o projeto.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden" role="region" aria-label="Orçamentos">
          {orcamentos.map((o) => (
            <div key={o.id} className="flex items-center gap-4 border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50/60">
              <Link href={`/orcamentos/${o.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-gray-500">{o.numero}</span>
                  <span className="font-medium text-grafite-800">{o.cliente}</span>
                  <span className="text-gray-500">· {o.projeto}</span>
                  <Badge tom={o.status === "RASCUNHO" ? "neutro" : "marca"}>{ROTULO_STATUS[o.status]}</Badge>
                </div>
                <p className="text-xs text-gray-500">
                  {o.itens} {o.itens === 1 ? "item" : "itens"}
                  {o.cidade && ` · ${o.cidade}${o.uf ? `/${o.uf}` : ""}`}
                  {verTodos && ` · ${o.vendedor.nome}`} · atualizado em {dataHora.format(o.atualizadoEm)}
                </p>
              </Link>
              {o.status === "RASCUNHO" && <AcoesDoOrcamento id={o.id} numero={o.numero} />}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
