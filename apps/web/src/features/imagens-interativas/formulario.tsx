"use client";
import { useRouter } from "next/navigation";
import { Campo, Input, Select } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { BotaoEnviar } from "@/ui/submit-button";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CaixaDeSelecao } from "@/features/equipamentos/formularios";
import { alternarAtivoImagemInterativa, excluirImagemInterativa } from "./actions";

export function FormImagemInterativa({
  acao,
  categorias,
  equipamentos,
  inicial,
  rotuloBotao,
}: {
  acao: (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;
  categorias: { id: string; rotulo: string }[];
  equipamentos: { id: string; nome: string }[];
  inicial?: { nome: string; dono: string; isDemo: boolean };
  rotuloBotao: string;
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Campo rotulo="Nome" erro={e.nome} ajuda="Ex.: Vista do aviário.">
        <Input name="nome" defaultValue={inicial?.nome} required maxLength={120} />
      </Campo>
      <Campo rotulo="Onde aparece" erro={e.dono} ajuda="Num sistema (catálogo) ou no painel de um equipamento.">
        <Select name="dono" defaultValue={inicial?.dono ?? ""} required>
          <option value="">Escolha…</option>
          <optgroup label="Categorias e sistemas">
            {categorias.map((c) => (
              <option key={c.id} value={`categoria:${c.id}`}>
                {c.rotulo}
              </option>
            ))}
          </optgroup>
          <optgroup label="Equipamentos">
            {equipamentos.map((x) => (
              <option key={x.id} value={`equipamento:${x.id}`}>
                {x.nome}
              </option>
            ))}
          </optgroup>
        </Select>
      </Campo>
      <Campo rotulo={inicial ? "Trocar imagem" : "Imagem"} erro={e.arquivo} ajuda="JPG, PNG ou WebP, até 4 MB.">
        <Input name="arquivo" type="file" accept="image/jpeg,image/png,image/webp" required={!inicial} className="h-auto py-2" />
      </Campo>
      <Campo rotulo="Texto alternativo" ajuda="Descreve a imagem para leitores de tela.">
        <Input name="textoAlternativo" maxLength={200} />
      </Campo>
      <CaixaDeSelecao name="isDemo" rotulo="Dado de demonstração (DEMO)" defaultChecked={inicial?.isDemo} />
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>{rotuloBotao}</BotaoEnviar>
      </div>
    </form>
  );
}

export function AcoesDaImagemInterativa({ id, nome, ativo, noCabecalho }: { id: string; nome: string; ativo: boolean; noCabecalho?: boolean }) {
  const router = useRouter();
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      hrefEditar={noCabecalho ? undefined : `/admin/imagens-interativas/${id}`}
      alternarAtivo={() => alternarAtivoImagemInterativa(id)}
      excluir={async () => {
        await excluirImagemInterativa(id);
        if (noCabecalho) router.push("/admin/imagens-interativas");
      }}
      avisoExclusao="A imagem e todas as áreas clicáveis serão apagadas."
    />
  );
}
