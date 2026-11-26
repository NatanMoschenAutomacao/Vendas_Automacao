import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { obterEquipamento } from "@/features/equipamentos/queries";
import { atualizarModelo, enviarImagem, removerImagem } from "@/features/equipamentos/actions";
import { FormImagem, FormModelo } from "@/features/equipamentos/formularios";
import { AcoesDoCabecalhoDoModelo } from "@/features/equipamentos/acoes";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";
import { carregarPerguntasDoEquipamento } from "@/features/perguntas/dados";
import { ListaDePerguntas } from "@/features/perguntas/lista";
import { variaveisDisponiveis } from "@/features/perguntas/variaveis";

export const metadata: Metadata = { title: "Modelo" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function PaginaModelo({ params }: PageProps<"/admin/equipamentos/[id]/modelos/[modeloId]">) {
  const { id, modeloId } = await params;
  if (!UUID.test(id) || !UUID.test(modeloId)) notFound();
  const e = await obterEquipamento(id);
  const m = e?.modelos.find((x) => x.id === modeloId);
  if (!e || !m) notFound();
  const dados = await carregarPerguntasDoEquipamento(e.id);
  const perguntasDoModelo = dados.modelos.find((x) => x.id === m.id)?.perguntas ?? [];
  const rotulos = Object.fromEntries(
    variaveisDisponiveis(dados.perguntasMotor, dados.definicoes).map((v) => [v.nome, v.rotulo.replace(/^[^›]+› /, "")]),
  );

  return (
    <>
      <Link
        href={`/admin/equipamentos/${e.id}?aba=modelos`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-grafite-800"
      >
        <ArrowLeft className="size-4" /> {e.nome}
      </Link>
      <CabecalhoDePagina
        titulo={m.nome}
        descricao={`Modelo de ${e.nome} · ${m.codigo}`}
        acoes={
          <div className="flex items-center gap-2">
            {!m.ativo && <Badge>Inativo</Badge>}
            {m.isDemo && <Badge tom="demo">DEMO</Badge>}
            <AcoesDoCabecalhoDoModelo id={m.id} equipamentoId={e.id} nome={m.nome} ativo={m.ativo} />
          </div>
        }
      />
      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_28rem]">
        <Card className="p-6">
          <FormModelo
            acao={atualizarModelo.bind(null, m.id)}
            definicoes={e.definicoes}
            valores={{ ...m, atributos: m.valores }}
          />
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 font-medium text-grafite-900">Imagem do modelo</h2>
          <FormImagem
            acao={enviarImagem.bind(null, "modelo", m.id)}
            remover={removerImagem.bind(null, "modelo", m.id)}
            url={m.imagemUrl}
            textoAlternativo={m.imagem?.textoAlternativo}
          />
        </Card>
      </div>
      <section className="mt-8 flex max-w-5xl flex-col gap-3">
        <div>
          <h2 className="font-medium text-grafite-900">Perguntas deste modelo</h2>
          <p className="text-sm text-gray-500">
            Valem as perguntas de {e.nome}. Aqui o modelo pode substituir ou ocultar alguma delas e ter perguntas próprias.
          </p>
        </div>
        <ListaDePerguntas
          perguntas={perguntasDoModelo}
          rotulos={rotulos}
          hrefBase={`/admin/equipamentos/${e.id}/modelos/${m.id}/perguntas`}
          hrefNova={`/admin/equipamentos/${e.id}/modelos/${m.id}/perguntas/nova`}
          vazio="Este modelo usa as perguntas do equipamento sem alterações."
        />
      </section>
    </>
  );
}
