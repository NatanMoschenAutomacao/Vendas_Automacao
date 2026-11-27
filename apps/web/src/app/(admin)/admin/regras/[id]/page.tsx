import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import type { Condicao } from "@zanatta/engine";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { salvarRegra } from "@/features/regras/actions";
import { AcoesDaRegra } from "@/features/regras/acoes";
import { carregarDono, carregarOpcoesDoEditor, donoDoBanco } from "@/features/regras/dados";
import { EditorDeRegra } from "@/features/regras/editor";
import { efeitoSchema, ESTAGIO_DO_BANCO, ROTULO_DONO, type DadosDaRegra } from "@/features/regras/schema";
import { Badge, CabecalhoDePagina, Card, Mensagem } from "@/ui/card";

export const metadata: Metadata = { title: "Regra" };

export default async function PaginaDaRegra({ params, searchParams }: PageProps<"/admin/regras/[id]">) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const r = await db.regra.findUnique({ where: { id } });
  if (!r) notFound();
  const dono = donoDoBanco(r);
  const [ctx, opcoes] = await Promise.all([carregarDono(dono), carregarOpcoesDoEditor()]);
  if (!ctx) notFound();
  const efeitos = (Array.isArray(r.efeitos) ? r.efeitos : []).flatMap((e) => {
    const p = efeitoSchema.safeParse(e);
    return p.success ? [p.data] : [];
  });
  const inicial: DadosDaRegra = {
    codigo: r.codigo,
    nome: r.nome,
    descricao: r.descricao,
    estagio: ESTAGIO_DO_BANCO[r.estagio],
    base: r.base as DadosDaRegra["base"],
    condicao: (r.condicao ?? null) as Condicao | null,
    prioridade: r.prioridade,
    permiteRemocao: r.permiteRemocao,
    ativo: r.ativo,
    isDemo: r.isDemo,
    efeitos,
  };
  return (
    <>
      <Link href={ctx.voltar} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <CabecalhoDePagina
        titulo={`Regra: ${r.nome}`}
        descricao={`${ROTULO_DONO[dono.tipo]} · ${ctx.rotulo}`}
        acoes={
          <div className="flex items-center gap-2">
            {!r.ativo && <Badge>Inativa</Badge>}
            {r.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDaRegra id={r.id} nome={r.nome} ativo={r.ativo} noCabecalho />
          </div>
        }
      />
      {sp.criada && (
        <div className="mb-4 max-w-5xl">
          <Mensagem tipo="sucesso">Regra criada.</Mensagem>
        </div>
      )}
      <Card className="max-w-5xl p-6">
        <EditorDeRegra
          inicial={inicial}
          dono={dono.tipo}
          comuns={ctx.comuns}
          itens={opcoes.itens}
          recursos={opcoes.recursos}
          servicos={opcoes.servicos}
          salvar={salvarRegra.bind(null, null, r.id)}
        />
      </Card>
    </>
  );
}
