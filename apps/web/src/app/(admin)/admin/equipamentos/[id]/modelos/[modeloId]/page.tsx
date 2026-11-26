import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { obterEquipamento } from "@/features/equipamentos/queries";
import { atualizarModelo, enviarImagem, removerImagem } from "@/features/equipamentos/actions";
import { FormImagem, FormModelo } from "@/features/equipamentos/formularios";
import { AcoesDoCabecalhoDoModelo } from "@/features/equipamentos/acoes";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Modelo" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function PaginaModelo({ params }: PageProps<"/admin/equipamentos/[id]/modelos/[modeloId]">) {
  const { id, modeloId } = await params;
  if (!UUID.test(id) || !UUID.test(modeloId)) notFound();
  const e = await obterEquipamento(id);
  const m = e?.modelos.find((x) => x.id === modeloId);
  if (!e || !m) notFound();

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
      <div className="flex max-w-3xl flex-col gap-6">
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
    </>
  );
}
