import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { FormDerivacao } from "@/features/equipamentos/derivacao";
import { notFound } from "next/navigation";
import { AlertTriangle, ArrowLeft, ImageOff } from "lucide-react";
import { formatarAtributo, type TipoDeDado } from "@zanatta/engine";
import { listarArvoreDeCategorias } from "@/features/categorias/queries";
import { opcoesDePai } from "@/features/categorias/opcoes-de-pai";
import { obterEquipamento } from "@/features/equipamentos/queries";
import {
  adicionarCaracteristicasEletricas,
  adicionarDefinicao,
  atualizarDefinicao,
  atualizarEquipamento,
  criarModelo,
  enviarImagem,
  salvarDerivacao,
  removerImagem,
} from "@/features/equipamentos/actions";
import {
  BotaoDeAcao,
  FormEdicaoDefinicao,
  FormEquipamento,
  FormImagem,
  FormNovaDefinicao,
  FormNovoModelo,
} from "@/features/equipamentos/formularios";
import { AcoesDaDefinicao, AcoesDoCabecalhoDoEquipamento, AcoesDoModelo } from "@/features/equipamentos/acoes";
import { ROTULO_TIPO_DADO, ROTULO_TIPO_EQUIPAMENTO } from "@/features/equipamentos/schema";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";
import { cn } from "@/lib/cn";
import { detectarCiclo, resolverPerguntas } from "@zanatta/engine";
import { carregarPerguntasDoEquipamento } from "@/features/perguntas/dados";
import { ListaDePerguntas } from "@/features/perguntas/lista";
import { PreVisualizacao } from "@/features/perguntas/pre-visualizacao";
import { variaveisDisponiveis } from "@/features/perguntas/variaveis";
import { ListaDeRegras } from "@/features/regras/lista";

export const metadata: Metadata = { title: "Equipamento" };

const ABAS = [
  { id: "geral", titulo: "Geral" },
  { id: "caracteristicas", titulo: "Características" },
  { id: "modelos", titulo: "Modelos" },
  { id: "perguntas", titulo: "Perguntas" },
  { id: "imagem", titulo: "Imagem" },
  { id: "imagens-interativas", titulo: "Imagens interativas" },
  { id: "estrutura", titulo: "Acionamento e proteção" },
  { id: "materiais", titulo: "Materiais e recursos" },
  { id: "controladores", titulo: "Controladores" },
] as const;

/** Abas que dependem das próximas fases aparecem desabilitadas. */
const ABAS_FUTURAS = [
  { titulo: "Preços", fase: 9 },
];

type Aba = (typeof ABAS)[number]["id"];

export default async function PaginaEquipamento({ params, searchParams }: PageProps<"/admin/equipamentos/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const aba: Aba = ABAS.some((a) => a.id === sp.aba) ? (sp.aba as Aba) : "geral";
  const e = await obterEquipamento(id);
  if (!e) notFound();
  const href = `/admin/equipamentos/${id}`;

  return (
    <>
      <Link href="/admin/equipamentos" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> Equipamentos
      </Link>
      <CabecalhoDePagina
        titulo={e.nome}
        descricao={`${e.codigo} · ${ROTULO_TIPO_EQUIPAMENTO[e.tipo]} · ${e.categoria.nome}`}
        acoes={
          <div className="flex items-center gap-2">
            {!e.ativo && <Badge>Inativo</Badge>}
            {e.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDoCabecalhoDoEquipamento id={e.id} nome={e.nome} ativo={e.ativo} />
          </div>
        }
      />
      <nav className="mb-6 flex flex-wrap gap-1 border-b border-gray-200" aria-label="Abas do equipamento">
        {ABAS.map((a) => (
          <Link
            key={a.id}
            href={`${href}?aba=${a.id}`}
            aria-current={aba === a.id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              aba === a.id ? "border-marca-600 text-marca-700" : "border-transparent text-gray-500 hover:text-grafite-800",
            )}
          >
            {a.titulo}
            {a.id === "modelos" && <span className="ml-1.5 text-xs text-gray-400">{e.modelos.length}</span>}
            {a.id === "caracteristicas" && <span className="ml-1.5 text-xs text-gray-400">{e.definicoes.length}</span>}
          </Link>
        ))}
        {ABAS_FUTURAS.map((a) => (
          <span key={a.titulo} className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300" title={`Disponível na Fase ${a.fase}`}>
            {a.titulo}
            <Badge className="bg-gray-50 text-gray-400">Fase {String(a.fase).padStart(2, "0")}</Badge>
          </span>
        ))}
      </nav>

      {aba === "geral" && <AbaGeral e={e} />}
      {aba === "caracteristicas" && <AbaCaracteristicas e={e} />}
      {aba === "modelos" && <AbaModelos e={e} />}
      {aba === "perguntas" && <AbaPerguntas e={e} />}
      {aba === "estrutura" && (
        <Card className="max-w-3xl p-6">
          <p className="mb-4 text-sm text-gray-500">
            Define quantos acionamentos e proteções cada unidade gera. Um modelo pode substituir esta regra.
          </p>
          <FormDerivacao acao={salvarDerivacao.bind(null, "equipamento", e.id)} valores={e} />
        </Card>
      )}
      {aba === "imagens-interativas" && <AbaImagensInterativas equipamentoId={e.id} />}
      {aba === "materiais" && <AbaMateriais equipamentoId={e.id} />}
      {aba === "controladores" && <AbaControladores equipamentoId={e.id} />}
      {aba === "imagem" && (
        <Card className="max-w-4xl p-6">
          <FormImagem
            acao={enviarImagem.bind(null, "equipamento", e.id)}
            remover={removerImagem.bind(null, "equipamento", e.id)}
            url={e.imagemUrl}
            textoAlternativo={e.imagem?.textoAlternativo}
          />
        </Card>
      )}
    </>
  );
}

type Equip = NonNullable<Awaited<ReturnType<typeof obterEquipamento>>>;

async function AbaGeral({ e }: { e: Equip }) {
  const { arvore } = await listarArvoreDeCategorias();
  return (
    <Card className="max-w-4xl p-6">
      <FormEquipamento
        acao={atualizarEquipamento.bind(null, e.id)}
        categorias={opcoesDePai(arvore)}
        valores={e}
        rotuloBotao="Salvar"
      />
    </Card>
  );
}

function AbaCaracteristicas({ e }: { e: Equip }) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">
            Campos que cada modelo deste equipamento deve preencher. Os valores ficam nos modelos.
          </p>
          <BotaoDeAcao acao={adicionarCaracteristicasEletricas.bind(null, e.id)}>
            Adicionar características elétricas padrão
          </BotaoDeAcao>
        </div>
        <Card className="overflow-hidden" role="region" aria-label="Campos técnicos">
          {e.definicoes.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-gray-500">Nenhum campo técnico ainda.</p>
          ) : (
            e.definicoes.map((d, i) => (
              <div key={d.id} className="flex items-start gap-2 border-b border-gray-100 pr-2 last:border-0">
                <details className="group min-w-0 flex-1">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-2.5 hover:bg-gray-50/60">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-grafite-800">{d.rotulo}</span>
                        {d.unidade && <span className="text-xs text-gray-500">({d.unidade})</span>}
                        {d.obrigatorio && <Badge tom="aviso">Obrigatório</Badge>}
                      </div>
                      <p className="truncate text-xs text-gray-500">
                        {ROTULO_TIPO_DADO[d.tipoDado]}
                        {d.opcoes.length > 0 && ` · ${d.opcoes.join(", ")}`}
                      </p>
                    </div>
                    <span className="text-xs text-marca-700 group-open:hidden">Editar</span>
                  </summary>
                  <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
                    <FormEdicaoDefinicao acao={atualizarDefinicao.bind(null, d.id)} valores={d} />
                  </div>
                </details>
                <div className="py-2">
                  <AcoesDaDefinicao id={d.id} nome={d.rotulo} primeira={i === 0} ultima={i === e.definicoes.length - 1} />
                </div>
              </div>
            ))
          )}
        </Card>
      </div>
      <Card className="h-fit p-5">
        <h2 className="mb-4 font-medium text-grafite-900">Novo campo técnico</h2>
        <FormNovaDefinicao acao={adicionarDefinicao.bind(null, e.id)} />
      </Card>
    </div>
  );
}

function AbaModelos({ e }: { e: Equip }) {
  const destaque = e.definicoes.slice(0, 3);
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <Card className="overflow-hidden" role="region" aria-label="Modelos">
        {e.modelos.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-gray-500">Nenhum modelo cadastrado.</p>
        ) : (
          e.modelos.map((m, i) => (
            <div key={m.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50/60">
              <div className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                {m.imagemUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imagemUrl} alt="" className="size-full object-cover" />
                ) : (
                  <ImageOff className="size-4 text-gray-300" />
                )}
              </div>
              <Link href={`/admin/equipamentos/${e.id}/modelos/${m.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={m.ativo ? "font-medium text-grafite-800" : "text-gray-400 line-through"}>{m.nome}</span>
                  {!m.ativo && <Badge>Inativo</Badge>}
                  {m.isDemo && <Badge tom="demo">DEMO</Badge>}
                  {m.faltantes.length > 0 && (
                    <Badge tom="aviso" title="Campos obrigatórios sem valor">
                      <AlertTriangle className="mr-1 size-3" />
                      {m.faltantes.length} {m.faltantes.length === 1 ? "campo pendente" : "campos pendentes"}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">
                  {[
                    m.codigo,
                    m.fabricante,
                    ...destaque
                      .map((d) => {
                        const t = formatarAtributo({ ...d, tipoDado: d.tipoDado as TipoDeDado }, m.valores[d.chave]);
                        return t && `${d.rotulo}: ${t}`;
                      })
                      .filter(Boolean),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </Link>
              <AcoesDoModelo
                id={m.id}
                equipamentoId={e.id}
                nome={m.nome}
                ativo={m.ativo}
                primeira={i === 0}
                ultima={i === e.modelos.length - 1}
              />
            </div>
          ))
        )}
      </Card>
      <Card className="h-fit p-5">
        <h2 className="mb-4 font-medium text-grafite-900">Novo modelo</h2>
        <FormNovoModelo acao={criarModelo.bind(null, e.id)} />
      </Card>
    </div>
  );
}

async function AbaPerguntas({ e }: { e: Equip }) {
  const dados = await carregarPerguntasDoEquipamento(e.id);
  const rotulos = Object.fromEntries(
    variaveisDisponiveis(dados.perguntasMotor, dados.definicoes).map((v) => [v.nome, v.rotulo.replace(/^[^›]+› /, "")]),
  );
  const problemas: string[] = [];
  const ciclo = detectarCiclo(dados.perguntasMotor);
  if (ciclo) problemas.push(`Referência circular no equipamento: ${ciclo.join(" → ")}.`);
  for (const m of dados.modelosMotor) {
    const r = resolverPerguntas(dados.perguntasMotor, m.perguntas);
    for (const er of r.erros) problemas.push(`${m.nome}: ${er}`);
    const c = detectarCiclo(r.perguntas);
    if (c) problemas.push(`${m.nome}: referência circular ${c.join(" → ")}.`);
  }
  return (
    <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_32rem]">
      <div className="flex flex-col gap-3">
        <p className="text-sm text-gray-500">
          Perguntas feitas ao vendedor para cada {e.nome.toLowerCase()} do orçamento. Os modelos podem substituir ou ocultar estas
          perguntas e ter perguntas próprias (na página de cada modelo).
        </p>
        {problemas.map((p) => (
          <p key={p} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {p}
          </p>
        ))}
        <ListaDePerguntas
          perguntas={dados.perguntas}
          rotulos={rotulos}
          hrefBase={`/admin/equipamentos/${e.id}/perguntas`}
          hrefNova={`/admin/equipamentos/${e.id}/perguntas/nova`}
          vazio="Nenhuma pergunta cadastrada para este equipamento."
        />
      </div>
      <Card className="p-5">
        <h2 className="mb-1 font-medium text-grafite-900">Pré-visualização</h2>
        <p className="mb-4 text-xs text-gray-500">Simule as respostas para ver quais perguntas aparecem. Nada é salvo.</p>
        <PreVisualizacao
          perguntas={dados.perguntasMotor}
          modelos={dados.modelosMotor.filter((m) => m.ativo)}
          rotulos={rotulos}
        />
      </Card>
    </div>
  );
}

async function AbaImagensInterativas({ equipamentoId }: { equipamentoId: string }) {
  const imagens = await db.imagemInterativa.findMany({
    where: { equipamentoId },
    orderBy: { nome: "asc" },
    include: { _count: { select: { hotspots: true } } },
  });
  return (
    <Card className="max-w-4xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm text-gray-500">Aparecem no painel do equipamento, no configurador do vendedor.</p>
        <Link href="/admin/imagens-interativas" className="text-sm font-medium text-marca-700 hover:underline">
          Nova imagem interativa
        </Link>
      </div>
      {imagens.length === 0 && <p className="px-4 py-6 text-sm text-gray-500">Nenhuma imagem interativa ligada a este equipamento.</p>}
      {imagens.map((i) => (
        <Link
          key={i.id}
          href={`/admin/imagens-interativas/${i.id}`}
          className="flex items-center justify-between border-b border-gray-100 px-4 py-3 text-sm last:border-0 hover:bg-gray-50"
        >
          <span className={i.ativo ? "font-medium text-grafite-800" : "text-gray-400 line-through"}>{i.nome}</span>
          <span className="text-xs text-gray-500">{i._count.hotspots} área(s)</span>
        </Link>
      ))}
    </Card>
  );
}

async function AbaMateriais({ equipamentoId }: { equipamentoId: string }) {
  const ordem = [{ estagio: "asc" as const }, { prioridade: "asc" as const }, { codigo: "asc" as const }];
  const [regras, modelos] = await Promise.all([
    db.regra.findMany({ where: { equipamentoId }, orderBy: ordem }),
    db.modelo.findMany({
      where: { equipamentoId },
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      select: { id: true, nome: true, item: { select: { codigo: true, descricao: true } }, regras: { orderBy: ordem } },
    }),
  ]);
  const novo = (q: string, rotulo: string) => (
    <Link href={`/admin/regras/nova?${q}`} className="inline-flex h-8 items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium hover:bg-gray-50">
      {rotulo}
    </Link>
  );
  return (
    <div className="flex max-w-5xl flex-col gap-6">
      <p className="text-sm text-gray-500">
        Regras do equipamento valem para todos os modelos. Use a base &quot;por acionamento&quot; ou &quot;por proteção&quot; para seguir a aba
        Acionamento e proteção. Recursos (DI, DO, AI, AO) formam a lista de I/O.
      </p>
      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
          <h2 className="font-medium text-grafite-900">Regras do equipamento</h2>
          <div className="flex gap-2">
            {novo(`dono=equipamento&id=${equipamentoId}`, "Nova regra de material")}
            {novo(`dono=equipamento&id=${equipamentoId}&estagio=recurso`, "Nova regra de recurso")}
          </div>
        </div>
        <ListaDeRegras regras={regras} vazio="Nenhuma regra neste equipamento." rotulo="Regras do equipamento" />
      </Card>
      {modelos.map((m) => (
        <Card key={m.id} className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5">
            <div>
              <h2 className="font-medium text-grafite-900">Modelo {m.nome}</h2>
              <p className="text-xs text-gray-500">
                Item de fornecimento: {m.item ? `${m.item.codigo} — ${m.item.descricao}` : "não definido (defina na página do modelo)"}
              </p>
            </div>
            {novo(`dono=modelo&id=${m.id}`, "Nova regra do modelo")}
          </div>
          <ListaDeRegras regras={m.regras} vazio="Sem regras próprias." rotulo={`Regras do modelo ${m.nome}`} />
        </Card>
      ))}
    </div>
  );
}

async function AbaControladores({ equipamentoId }: { equipamentoId: string }) {
  const modelos = await db.modelo.findMany({
    where: { equipamentoId },
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: { id: true, nome: true, controladores: { select: { id: true, ativo: true, item: { select: { codigo: true, descricao: true } } } } },
  });
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <p className="text-sm text-gray-500">
        A compatibilidade é marcada na página de cada controlador. Controladores sem lista de modelos são aceitos com aviso para conferência
        técnica.
      </p>
      <Card className="overflow-hidden">
        <ul className="divide-y divide-gray-100" aria-label="Controladores compatíveis por modelo">
          {modelos.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <p className="font-medium text-grafite-900">{m.nome}</p>
              {m.controladores.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum controlador declarou compatibilidade.</p>
              ) : (
                <div className="mt-1 flex flex-wrap gap-2">
                  {m.controladores.map((c) => (
                    <Link key={c.id} href={`/admin/controladores/${c.id}`} className="rounded-md bg-gray-50 px-2 py-1 text-sm hover:bg-gray-100">
                      {c.item.descricao} <span className="font-mono text-xs text-gray-500">{c.item.codigo}</span>
                      {!c.ativo && " (inativo)"}
                    </Link>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <div>
        <Link href="/admin/controladores" className="text-sm text-marca-700 hover:underline">
          Abrir controladores
        </Link>
      </div>
    </div>
  );
}
