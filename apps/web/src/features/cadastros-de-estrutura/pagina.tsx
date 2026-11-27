import Link from "next/link";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";
import { criarTiposDeRecursoPadrao, salvarCadastro } from "./actions";
import { AcoesDoCadastro, BotaoTiposPadrao, FormCadastro } from "./componentes";
import { INFO_DO_CADASTRO, type Cadastro } from "./schema";

/** Página de lista + formulário dos cadastros simples da estrutura. */
export async function PaginaDeCadastro({ cadastro, editar }: { cadastro: Cadastro; editar?: string }) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const info = INFO_DO_CADASTRO[cadastro];
  const ordem = [{ ordem: "asc" as const }, { nome: "asc" as const }];
  const itens: { id: string; codigo?: string; nome: string; descricao: string | null; ativo: boolean; isDemo: boolean; fisico?: boolean }[] =
    cadastro === "tipo-de-painel"
      ? await db.tipoDePainel.findMany({ orderBy: ordem })
      : cadastro === "tipo-de-recurso"
        ? await db.tipoDeRecurso.findMany({ orderBy: ordem })
        : await db.funcaoDeControle.findMany({ orderBy: ordem });
  const emEdicao = editar ? itens.find((i) => i.id === editar) : undefined;
  return (
    <>
      <CabecalhoDePagina
        titulo={info.titulo}
        descricao={info.descricao}
        acoes={cadastro === "tipo-de-recurso" ? <BotaoTiposPadrao acao={criarTiposDeRecursoPadrao} /> : undefined}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="h-fit overflow-hidden" role="region" aria-label={info.titulo}>
          {itens.length === 0 && <p className="px-4 py-12 text-center text-sm text-gray-500">Nenhum cadastro ainda.</p>}
          {itens.map((i, n) => (
            <div key={i.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={i.ativo ? "font-medium text-grafite-800" : "text-gray-400 line-through"}>{i.nome}</span>
                  {i.codigo && <span className="font-mono text-xs text-gray-500">{i.codigo}</span>}
                  {i.fisico === false && <Badge>Não físico</Badge>}
                  {!i.ativo && <Badge>Inativo</Badge>}
                  {i.isDemo && <Badge tom="demo">DEMO</Badge>}
                </div>
                {i.descricao && <p className="text-xs text-gray-500">{i.descricao}</p>}
              </div>
              <AcoesDoCadastro cadastro={cadastro} id={i.id} nome={i.nome} ativo={i.ativo} primeira={n === 0} ultima={n === itens.length - 1} />
            </div>
          ))}
        </Card>
        <Card className="h-fit p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium text-grafite-900">{emEdicao ? `Editar ${info.singular}` : info.novo}</h2>
            {emEdicao && (
              <Link href={info.caminho} className="text-sm text-gray-500 hover:text-grafite-800">
                Cancelar
              </Link>
            )}
          </div>
          <FormCadastro
            key={emEdicao?.id ?? "novo"}
            cadastro={cadastro}
            acao={salvarCadastro.bind(null, cadastro, emEdicao?.id ?? null)}
            inicial={emEdicao}
          />
        </Card>
      </div>
    </>
  );
}
