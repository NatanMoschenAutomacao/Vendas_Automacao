"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { BASES_POR_DONO, type DescricaoDeVariavel, type DonoDaRegra } from "@zanatta/engine";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { BotaoIcone } from "@/ui/acoes-de-linha";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { ConstrutorDeCondicao } from "@/features/perguntas/construtor-de-condicao";
import { ROTULO_ACAO, ROTULO_ARREDONDAMENTO, ROTULO_BASE, type DadosDaRegra, type EfeitoEditado } from "./schema";
import { variaveisDaRegra } from "./variaveis";

export interface OpcaoDeItem {
  id: string;
  codigo: string;
  descricao: string;
  unidade: string;
  ativo: boolean;
}

export interface OpcaoDeRecurso {
  id: string;
  codigo: string;
  nome: string;
  ativo: boolean;
}


function novoEfeito(acao: EfeitoEditado["acao"]): EfeitoEditado {
  switch (acao) {
    case "adicionar":
    case "quantidade":
      return { acao, itemId: "", formula: "base.quantidade", arredondamento: "cima" };
    case "substituir":
      return { acao, itemId: "", substitutoId: "" };
    case "remover":
      return { acao, itemId: "" };
    case "recurso":
      return { acao, tipoRecursoId: "", funcao: null, formula: "base.quantidade" };
  }
}

function SeletorDeItem({
  rotulo,
  valor,
  itens,
  onChange,
}: {
  rotulo: string;
  valor: string;
  itens: OpcaoDeItem[];
  onChange: (id: string) => void;
}) {
  return (
    <Campo rotulo={rotulo}>
      <Select value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        {itens
          .filter((i) => i.ativo || i.id === valor)
          .map((i) => (
            <option key={i.id} value={i.id}>
              {i.codigo} — {i.descricao} ({i.unidade}){i.ativo ? "" : " [inativo]"}
            </option>
          ))}
      </Select>
    </Campo>
  );
}

/** Editor de uma regra de composição ou de recursos (Fase 06). */
export function EditorDeRegra({
  inicial,
  dono,
  comuns,
  itens,
  recursos,
  salvar,
}: {
  inicial: DadosDaRegra;
  dono: DonoDaRegra["tipo"];
  comuns: DescricaoDeVariavel[];
  itens: OpcaoDeItem[];
  recursos: OpcaoDeRecurso[];
  salvar: (json: string) => Promise<EstadoDoFormulario>;
}) {
  const [d, setD] = useState<DadosDaRegra>(() => ({
    ...inicial,
    base: BASES_POR_DONO[dono].includes(inicial.base) ? inicial.base : BASES_POR_DONO[dono][0]!,
  }));
  const [estado, setEstado] = useState<EstadoDoFormulario>({});
  const [pendente, iniciar] = useTransition();
  const e = estado.erros ?? {};
  const mudar = (m: Partial<DadosDaRegra>) => setD((x) => ({ ...x, ...m }));
  const mudarEfeito = (n: number, ef: EfeitoEditado) => setD((x) => ({ ...x, efeitos: x.efeitos.map((y, i) => (i === n ? ef : y)) }));
  const variaveis = variaveisDaRegra(comuns, dono, d.base);
  const acoes: EfeitoEditado["acao"][] = d.estagio === "recurso" ? ["recurso"] : ["adicionar", "substituir", "quantidade", "remover"];

  return (
    <div className="flex flex-col gap-6">
      <div className="@container grid gap-4">
        <div className="grid gap-4 @lg:grid-cols-[12rem_minmax(0,1fr)]">
          <Campo rotulo="Código" erro={e.codigo} ajuda="Único. Ex.: EXA-CONTATOR.">
            <Input value={d.codigo} maxLength={40} onChange={(x) => mudar({ codigo: x.target.value.toUpperCase() })} />
          </Campo>
          <Campo rotulo="Nome" erro={e.nome}>
            <Input value={d.nome} maxLength={120} onChange={(x) => mudar({ nome: x.target.value })} />
          </Campo>
        </div>
        <Campo rotulo="Descrição" erro={e.descricao}>
          <Textarea value={d.descricao ?? ""} maxLength={1000} onChange={(x) => mudar({ descricao: x.target.value })} />
        </Campo>
        <div className="grid gap-4 @lg:grid-cols-3">
          <Campo rotulo="Estágio" erro={e.estagio} ajuda="Recursos são calculados antes dos materiais.">
            <Select
              value={d.estagio}
              onChange={(x) => {
                const estagio = x.target.value as DadosDaRegra["estagio"];
                mudar({ estagio, efeitos: d.efeitos.filter((ef) => (estagio === "recurso") === (ef.acao === "recurso")) });
              }}
            >
              <option value="material">Material</option>
              <option value="recurso">Recurso de automação</option>
            </Select>
          </Campo>
          <Campo rotulo="Base de cálculo" erro={e.base}>
            <Select value={d.base} onChange={(x) => mudar({ base: x.target.value as DadosDaRegra["base"] })}>
              {BASES_POR_DONO[dono].map((b) => (
                <option key={b} value={b}>
                  {ROTULO_BASE[b]}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo="Prioridade" erro={e.prioridade} ajuda="Menor número roda antes.">
            <Input
              type="number"
              min={0}
              max={10000}
              step={1}
              value={d.prioridade}
              onChange={(x) => mudar({ prioridade: Math.trunc(Number(x.target.value) || 0) })}
            />
          </Campo>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2 text-sm text-grafite-700">
            <input type="checkbox" className="size-4 accent-marca-600" checked={d.permiteRemocao} onChange={(x) => mudar({ permiteRemocao: x.target.checked })} />
            Permite que outras regras removam os itens desta
          </label>
          <label className="flex items-center gap-2 text-sm text-grafite-700">
            <input type="checkbox" className="size-4 accent-marca-600" checked={d.ativo} onChange={(x) => mudar({ ativo: x.target.checked })} />
            Ativa
          </label>
          <label className="flex items-center gap-2 text-sm text-grafite-700">
            <input type="checkbox" className="size-4 accent-marca-600" checked={d.isDemo} onChange={(x) => mudar({ isDemo: x.target.checked })} />
            Dado de demonstração (DEMO)
          </label>
        </div>
      </div>

      <section aria-label="Condição da regra" className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-grafite-900">Quando aplicar</h3>
        <ConstrutorDeCondicao valor={d.condicao} onChange={(condicao) => mudar({ condicao })} variaveis={variaveis} rotuloSempre="Sempre" />
        {e.condicao && <span className="text-xs text-red-600">{e.condicao}</span>}
      </section>

      <section aria-label="Efeitos da regra" className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-grafite-900">Efeitos</h3>
        {e.efeitos && <span className="text-xs text-red-600">{e.efeitos}</span>}
        {d.efeitos.length === 0 && <p className="text-sm text-gray-500">Nenhum efeito ainda.</p>}
        {d.efeitos.map((ef, n) => (
          <div key={n} className="@container rounded-lg border border-gray-200 p-3" data-efeito={n}>
            <div className="grid items-end gap-3 @lg:grid-cols-[14rem_minmax(0,1fr)_auto]">
              <Campo rotulo={`Ação do efeito ${n + 1}`}>
                <Select value={ef.acao} onChange={(x) => mudarEfeito(n, novoEfeito(x.target.value as EfeitoEditado["acao"]))}>
                  {acoes.map((a) => (
                    <option key={a} value={a}>
                      {ROTULO_ACAO[a]}
                    </option>
                  ))}
                </Select>
              </Campo>
              {ef.acao === "recurso" ? (
                <Campo rotulo={`Tipo de recurso do efeito ${n + 1}`}>
                  <Select value={ef.tipoRecursoId} onChange={(x) => mudarEfeito(n, { ...ef, tipoRecursoId: x.target.value })}>
                    <option value="">Escolha…</option>
                    {recursos
                      .filter((r) => r.ativo || r.id === ef.tipoRecursoId)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.codigo} — {r.nome}
                        </option>
                      ))}
                  </Select>
                </Campo>
              ) : (
                <SeletorDeItem rotulo={`Item do efeito ${n + 1}`} valor={ef.itemId} itens={itens} onChange={(itemId) => mudarEfeito(n, { ...ef, itemId })} />
              )}
              <div className="pb-1">
                <BotaoIcone titulo={`Remover efeito ${n + 1}`} perigo onClick={() => mudar({ efeitos: d.efeitos.filter((_, i) => i !== n) })}>
                  <Trash2 className="size-4" />
                </BotaoIcone>
              </div>
            </div>
            <div className="mt-3 grid gap-3 @lg:grid-cols-2">
              {ef.acao === "substituir" && (
                <SeletorDeItem
                  rotulo={`Substituto do efeito ${n + 1}`}
                  valor={ef.substitutoId}
                  itens={itens}
                  onChange={(substitutoId) => mudarEfeito(n, { ...ef, substitutoId })}
                />
              )}
              {"formula" in ef && (
                <Campo rotulo={`Fórmula do efeito ${n + 1}`} ajuda="Ex.: base.quantidade * 2, se(painel.tensao > 220, 2, 1).">
                  <Input value={ef.formula} maxLength={500} className="font-mono" onChange={(x) => mudarEfeito(n, { ...ef, formula: x.target.value })} />
                </Campo>
              )}
              {(ef.acao === "adicionar" || ef.acao === "quantidade") && (
                <Campo rotulo={`Arredondamento do efeito ${n + 1}`} ajuda="Itens não fracionáveis sempre arredondam para cima.">
                  <Select value={ef.arredondamento} onChange={(x) => mudarEfeito(n, { ...ef, arredondamento: x.target.value as typeof ef.arredondamento })}>
                    {Object.entries(ROTULO_ARREDONDAMENTO).map(([v, r]) => (
                      <option key={v} value={v}>
                        {r}
                      </option>
                    ))}
                  </Select>
                </Campo>
              )}
              {ef.acao === "recurso" && (
                <Campo rotulo={`Função do sinal do efeito ${n + 1}`} ajuda="Opcional. Ex.: Liga/desliga.">
                  <Input value={ef.funcao ?? ""} maxLength={80} onChange={(x) => mudarEfeito(n, { ...ef, funcao: x.target.value })} />
                </Campo>
              )}
            </div>
            {e[`efeito-${n}`] && <p className="mt-2 text-xs text-red-600">{e[`efeito-${n}`]}</p>}
          </div>
        ))}
        <div>
          <Button variante="secundario" type="button" onClick={() => mudar({ efeitos: [...d.efeitos, novoEfeito(acoes[0]!)] })}>
            <Plus className="size-4" /> Adicionar efeito
          </Button>
        </div>
        <details className="text-sm text-gray-600">
          <summary className="cursor-pointer text-gray-500">Variáveis disponíveis nas fórmulas</summary>
          <ul className="mt-2 grid gap-x-6 gap-y-1 font-mono text-xs sm:grid-cols-2">
            {variaveis.map((v) => (
              <li key={v.nome} title={v.rotulo}>
                {v.nome}
              </li>
            ))}
          </ul>
        </details>
      </section>

      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <Button type="button" disabled={pendente} onClick={() => iniciar(async () => setEstado(await salvar(JSON.stringify(d))))}>
          {pendente ? "Aguarde…" : "Salvar regra"}
        </Button>
      </div>
    </div>
  );
}
