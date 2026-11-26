"use client";
import { useMemo, useState } from "react";
import { EyeOff } from "lucide-react";
import {
  avaliarPerguntas,
  descreverCondicao,
  resolverPerguntas,
  type Pergunta,
  type PerguntaDeModelo,
  type Valor,
  type ValorDeResposta,
} from "@zanatta/engine";
import { Badge } from "@/ui/card";
import { Input, Select } from "@/ui/input";
import { CampoDeResposta } from "./campo-de-resposta";

export interface ModeloParaPrevia {
  id: string;
  nome: string;
  atributos: Record<string, unknown>;
  perguntas: PerguntaDeModelo[];
}

/** Simula as respostas e mostra quais perguntas apareceriam e o que ficaria pendente. */
export function PreVisualizacao({
  perguntas,
  modelos,
  rotulos,
}: {
  perguntas: Pergunta[];
  modelos: ModeloParaPrevia[];
  rotulos: Record<string, string>;
}) {
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [quantidade, setQuantidade] = useState(1);
  const [respostas, setRespostas] = useState<Record<string, ValorDeResposta | null>>({});
  const modelo = modelos.find((m) => m.id === modeloId);

  const r = useMemo(() => {
    const heranca = resolverPerguntas(perguntas, modelo?.perguntas ?? []);
    const ctx: Record<string, Valor> = { "instancia.quantidade": quantidade, "instancia.fornecimento": "fornecido" };
    for (const [k, v] of Object.entries(modelo?.atributos ?? {})) ctx[`modelo.${k}`] = v as Valor;
    return { heranca, aval: avaliarPerguntas(heranca.perguntas, respostas, ctx) };
  }, [perguntas, modelo, quantidade, respostas]);

  return (
    <div className="flex flex-col gap-5" role="region" aria-label="Pré-visualização">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-grafite-700">
          Modelo simulado
          <Select value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
            <option value="">(sem modelo)</option>
            {modelos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-grafite-700">
          Quantidade
          <Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))} />
        </label>
      </div>
      {r.heranca.erros.map((er) => (
        <p key={er} className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {er}
        </p>
      ))}
      {r.aval.itens.length === 0 && <p className="text-sm text-gray-500">Nenhuma pergunta para simular.</p>}
      <div className="flex flex-col gap-4">
        {r.aval.itens.map((it) =>
          it.visivel ? (
            <div key={it.pergunta.chave} data-pergunta={it.pergunta.chave}>
              <CampoDeResposta
                pergunta={it.pergunta}
                opcoes={it.opcoes}
                valor={respostas[it.pergunta.chave] ?? it.pergunta.padrao ?? null}
                valorAutomatico={it.valor}
                erro={it.erro}
                onChange={(v) => setRespostas((x) => ({ ...x, [it.pergunta.chave]: v }))}
              />
            </div>
          ) : (
            <div key={it.pergunta.chave} className="flex items-center gap-2 text-sm text-gray-400" data-oculta={it.pergunta.chave}>
              <EyeOff className="size-4 shrink-0" />
              <span>
                <span className="line-through">{it.pergunta.texto}</span>
                <span className="ml-2 text-xs">oculta: {descreverCondicao(it.pergunta.condicao, rotulos)}</span>
              </span>
            </div>
          ),
        )}
      </div>
      <div className="rounded-lg bg-gray-50 p-3 text-sm">
        <div className="mb-1 font-medium text-grafite-800">Resultado</div>
        {r.aval.pendencias.length === 0 ? (
          <p className="text-marca-700">Sem pendências.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {r.aval.pendencias.map((p, i) => (
              <li key={i} className="flex items-start gap-2">
                <Badge tom={p.gravidade === "impeditiva" ? "aviso" : "neutro"}>{p.gravidade}</Badge>
                {p.mensagem}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 font-mono text-xs text-gray-500">
          {Object.entries(r.aval.valores)
            .map(([k, v]) => `resposta.${k} = ${JSON.stringify(v)}`)
            .join(" · ") || "Nenhuma resposta válida ainda."}
        </p>
      </div>
    </div>
  );
}
