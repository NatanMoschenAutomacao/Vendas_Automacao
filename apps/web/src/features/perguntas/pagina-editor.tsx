import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { resolverPerguntas } from "@zanatta/engine";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { db } from "@/server/db";
import { CabecalhoDePagina, Card } from "@/ui/card";
import { salvarPergunta } from "./actions";
import { paraPergunta } from "./conversao";
import { carregarPerguntasDoEquipamento } from "./dados";
import { EditorDePergunta } from "./editor-de-pergunta";
import type { DadosDaPergunta } from "./schema";
import { variaveisDisponiveis } from "./variaveis";

const UUID = /^[0-9a-f-]{36}$/i;

const VAZIA: DadosDaPergunta = {
  chave: "",
  modo: "NOVA",
  texto: "",
  ajuda: null,
  tipo: "SELECAO_UNICA",
  unidade: null,
  obrigatoria: false,
  minimo: null,
  maximo: null,
  passo: null,
  padrao: null,
  condicao: null,
  opcoes: [],
  atributo: null,
  formula: null,
  ativo: true,
};

/** Página de criação/edição de pergunta do equipamento ou de um modelo. */
export async function PaginaEditorDePergunta({
  equipamentoId,
  modeloId,
  perguntaId,
}: {
  equipamentoId: string;
  modeloId?: string;
  perguntaId?: string;
}) {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  if (!UUID.test(equipamentoId) || (modeloId && !UUID.test(modeloId)) || (perguntaId && !UUID.test(perguntaId))) notFound();
  const eq = await carregarPerguntasDoEquipamento(equipamentoId).catch(() => null);
  if (!eq) notFound();
  const modelo = modeloId ? eq.modelosMotor.find((m) => m.id === modeloId) : undefined;
  if (modeloId && !modelo) notFound();

  const linha = perguntaId ? await db.pergunta.findUnique({ where: { id: perguntaId } }) : null;
  if (perguntaId && (!linha || (modeloId ? linha.modeloId !== modeloId : linha.equipamentoId !== equipamentoId))) notFound();

  const inicial: DadosDaPergunta = linha
    ? {
        ...VAZIA,
        ...paraPergunta(linha),
        modo: linha.modo,
        ativo: linha.ativo,
        tipo: paraPergunta(linha).tipo,
        opcoes: paraPergunta(linha).opcoes.map((o) => ({ ...o, imagemUrl: o.imagemUrl ?? null, condicao: o.condicao ?? null })),
        ajuda: linha.ajuda,
        unidade: linha.unidade,
        padrao: (linha.padrao ?? null) as DadosDaPergunta["padrao"],
      }
    : VAZIA;

  const efetivas = modelo ? resolverPerguntas(eq.perguntasMotor, modelo.perguntas).perguntas : eq.perguntasMotor;
  const variaveis = variaveisDisponiveis(efetivas.filter((p) => p.chave !== linha?.chave), eq.definicoes);
  const voltar = modelo ? `/admin/equipamentos/${eq.id}/modelos/${modelo.id}` : `/admin/equipamentos/${eq.id}?aba=perguntas`;
  const dono = modelo ? { modeloId: modelo.id } : { equipamentoId: eq.id };

  return (
    <>
      <Link href={voltar} className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800">
        <ArrowLeft className="size-4" /> {modelo ? `${eq.nome} › ${modelo.nome}` : eq.nome}
      </Link>
      <CabecalhoDePagina
        titulo={linha ? `Pergunta: ${linha.texto}` : "Nova pergunta"}
        descricao={modelo ? `Pergunta do modelo ${modelo.nome}` : `Pergunta do equipamento ${eq.nome}`}
      />
      <Card className="max-w-5xl p-6">
        <EditorDePergunta
          acao={salvarPergunta.bind(null, dono, linha?.id ?? null)}
          inicial={inicial}
          novo={!linha}
          dono={modelo ? "modelo" : "equipamento"}
          perguntasDoEquipamento={eq.perguntasMotor}
          variaveis={variaveis}
          atributos={eq.definicoes.map((d) => ({ chave: d.chave, rotulo: d.rotulo }))}
        />
      </Card>
    </>
  );
}
