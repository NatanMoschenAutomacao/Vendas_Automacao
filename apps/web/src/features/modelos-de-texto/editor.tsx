"use client";
import { useState, useTransition } from "react";
import { preencherTexto, type DescricaoDeVariavel, type DonoDaRegra } from "@zanatta/engine";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { ConstrutorDeCondicao } from "@/features/perguntas/construtor-de-condicao";
import { variaveisDaRegra } from "@/features/regras/variaveis";
import { alternarAtivoModeloDeTexto, excluirModeloDeTexto } from "./actions";
import { BASE_DO_DONO, ROTULO_SECAO, VARIAVEIS_DE_TEXTO, type DadosDoModeloDeTexto } from "./schema";

/** Valores de exemplo só para a pré-visualização do texto. */
const EXEMPLO: Record<string, string | number> = {
  quantidade: 4,
  "equipamento.nome": "Exaustor",
  "modelo.nome": "Modelo 01",
  "ambiente.nome": "Aviário 1 e Aviário 2",
  "painel.identificacao": "QC-01",
  "painel.tipo": "Controle",
  "painel.tensao": 220,
  "controlador.nome": "Controlador do galpão",
  "controlador.modelo": "Controlador",
  fornecimento: "fornecido",
};

export function EditorDeModeloDeTexto({
  inicial,
  dono,
  comuns,
  salvar,
}: {
  inicial: DadosDoModeloDeTexto;
  dono: DonoDaRegra["tipo"];
  comuns: DescricaoDeVariavel[];
  salvar: (json: string) => Promise<EstadoDoFormulario>;
}) {
  const [d, setD] = useState(inicial);
  const [estado, setEstado] = useState<EstadoDoFormulario>({});
  const [pendente, iniciar] = useTransition();
  const e = estado.erros ?? {};
  const mudar = (m: Partial<DadosDoModeloDeTexto>) => setD((x) => ({ ...x, ...m }));
  const variaveis = variaveisDaRegra(comuns, dono, BASE_DO_DONO[dono]);
  const exemplo = preencherTexto(d.texto, EXEMPLO).texto;
  return (
    <div className="@container flex flex-col gap-5" role="form" aria-label="Modelo de texto">
      <div className="grid gap-4 @lg:grid-cols-[1fr_8rem]">
        <Campo rotulo="Seção do descritivo" erro={e.secao}>
          <Select value={d.secao} onChange={(x) => mudar({ secao: x.target.value as DadosDoModeloDeTexto["secao"] })}>
            {Object.entries(ROTULO_SECAO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Ordem" erro={e.ordem}>
          <Input inputMode="numeric" value={String(d.ordem)} onChange={(x) => mudar({ ordem: Number(x.target.value) || 0 })} />
        </Campo>
      </div>
      <Campo rotulo="Texto" erro={e.texto} ajuda="Use {{variavel}} e {{plural:singular|plural}} (pela quantidade).">
        <Textarea rows={5} value={d.texto} maxLength={4000} onChange={(x) => mudar({ texto: x.target.value })} />
      </Campo>
      <div className="rounded-lg bg-gray-50 p-3 text-sm">
        <p className="mb-1 text-xs font-medium uppercase text-gray-500">Exemplo com valores fictícios</p>
        <p className="text-grafite-800" data-campo="exemplo">
          {exemplo || "—"}
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Variáveis: {[...VARIAVEIS_DE_TEXTO[dono].map((v) => v.nome), ...variaveis.map((v) => v.nome)].map((n) => `{{${n}}}`).join(", ")}
        </p>
      </div>
      <div>
        <p className="mb-1.5 text-sm font-medium text-grafite-700">Quando usar</p>
        <ConstrutorDeCondicao valor={d.condicao} onChange={(condicao) => mudar({ condicao })} variaveis={variaveis} />
        {e.condicao && <p className="mt-1 text-xs text-red-600">{e.condicao}</p>}
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-grafite-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={d.ativo} onChange={(x) => mudar({ ativo: x.target.checked })} /> Ativo
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={d.isDemo} onChange={(x) => mudar({ isDemo: x.target.checked })} /> Dado de demonstração (DEMO)
        </label>
      </div>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <Button type="button" disabled={pendente} onClick={() => iniciar(async () => setEstado((await salvar(JSON.stringify(d))) ?? {}))}>
          Salvar modelo de texto
        </Button>
      </div>
    </div>
  );
}

export function AcoesDoModeloDeTexto({ id, nome, ativo, voltar }: { id: string; nome: string; ativo: boolean; voltar?: string }) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      hrefEditar={voltar ? undefined : `/admin/modelos-de-texto/${id}`}
      alternarAtivo={alternarAtivoModeloDeTexto.bind(null, id)}
      excluir={excluirModeloDeTexto.bind(null, id, voltar)}
    />
  );
}
