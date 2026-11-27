"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  adicionarAmbiente,
  adicionarGrupo,
  adicionarPainel,
  adicionarSetor,
  atualizarGrupo,
  atualizarPainel,
  definirMembro,
  removerAmbiente,
  removerGrupo,
  removerPainel,
  removerSetor,
  renomearAmbiente,
  renomearSetor,
  type ConfiguracaoDoProjeto,
  type ResultadoDaEstrutura,
} from "@zanatta/engine";
import { Badge, Card } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input, Select } from "@/ui/input";
import { BotaoIcone } from "@/ui/acoes-de-linha";
import type { BibliotecaDoConfigurador } from "./tipos";

type Mudar = (f: (c: ConfiguracaoDoProjeto) => ConfiguracaoDoProjeto) => void;
const novoId = () => crypto.randomUUID();

/** Campo de texto + botão para criar algo pelo nome (Enter também cria). */
function NovoPorNome({ rotulo, botao, aoCriar, desabilitado }: { rotulo: string; botao: string; aoCriar: (nome: string) => void; desabilitado?: boolean }) {
  const [nome, setNome] = useState("");
  const criar = () => {
    if (!nome.trim()) return;
    aoCriar(nome);
    setNome("");
  };
  return (
    <div className="flex gap-2">
      <Input
        aria-label={rotulo}
        placeholder={rotulo}
        value={nome}
        maxLength={120}
        disabled={desabilitado}
        onChange={(e) => setNome(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            criar();
          }
        }}
      />
      <Button type="button" variante="secundario" disabled={desabilitado || !nome.trim()} onClick={criar}>
        <Plus className="size-4" /> {botao}
      </Button>
    </div>
  );
}

export function ResumoDaEstrutura({ estrutura }: { estrutura: ResultadoDaEstrutura }) {
  const t = estrutura.totais;
  const itens: [string, number, string?][] = [
    ["Equipamentos", t.equipamentos, t.existentes ? `${t.existentes} existente(s)` : undefined],
    ["Acionamentos", t.acionamentos],
    ["Proteções", t.protecoes],
    ["Grupos de controle", t.grupos],
    ["Ambientes", t.ambientes, t.compartilhadas ? `${t.compartilhadas} item(ns) compartilhado(s)` : undefined],
    ["Setores", t.setores],
    ["Painéis", t.paineis],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7" aria-label="Resumo da estrutura">
      {itens.map(([rotulo, valor, nota]) => (
        <div key={rotulo} className="rounded-card border border-gray-200 bg-white px-3 py-2" data-total={rotulo}>
          <dt className="text-xs text-gray-500">{rotulo}</dt>
          <dd className="text-lg font-semibold text-grafite-900">{valor}</dd>
          {nota && <dd className="text-xs text-gray-500">{nota}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function PainelDeEstrutura({
  config,
  mudar,
  biblioteca,
  estrutura,
  editavel,
  nomeDaInstancia,
}: {
  config: ConfiguracaoDoProjeto;
  mudar: Mudar;
  biblioteca: BibliotecaDoConfigurador;
  estrutura: ResultadoDaEstrutura;
  editavel: boolean;
  nomeDaInstancia: (id: string) => string;
}) {
  const ambientes = config.ambientes ?? [];
  const setores = config.setores ?? [];
  const paineis = config.paineis ?? [];
  const tipos = biblioteca.tiposDePainel.filter((t) => t.ativo || paineis.some((p) => p.tipoId === t.id));

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card className="flex flex-col gap-4 p-4" role="region" aria-label="Ambientes e setores">
        <div>
          <h2 className="font-medium text-grafite-900">Ambientes e setores</h2>
          <p className="text-sm text-gray-500">Galpões, estufas ou áreas. Um item que atende mais de um ambiente é contado uma vez só.</p>
        </div>
        {ambientes.length === 0 && <p className="text-sm text-gray-500">O projeto não está dividido em ambientes.</p>}
        {ambientes.map((a) => {
          const doAmbiente = estrutura.porAmbiente.find((x) => x.ambienteId === a.id);
          return (
            <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-3" data-ambiente={a.nome}>
              <div className="flex items-center gap-2">
                <Input aria-label="Nome do ambiente" value={a.nome} disabled={!editavel} maxLength={120} onChange={(e) => mudar((c) => renomearAmbiente(c, a.id, e.target.value))} />
                {editavel && (
                  <BotaoIcone titulo={`Remover ambiente ${a.nome}`} perigo onClick={() => mudar((c) => removerAmbiente(c, a.id))}>
                    <Trash2 className="size-4" />
                  </BotaoIcone>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {doAmbiente?.quantidade ?? 0} equipamento(s):{" "}
                {doAmbiente?.instancias.map((i) => `${i.quantidade}× ${nomeDaInstancia(i.instanciaId)}${i.compartilhada ? " (compartilhado)" : ""}`).join(", ") || "nenhum"}
              </p>
              <div className="flex flex-col gap-2 pl-3">
                {setores
                  .filter((s) => s.ambienteId === a.id)
                  .map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Input aria-label="Nome do setor" value={s.nome} disabled={!editavel} maxLength={120} onChange={(e) => mudar((c) => renomearSetor(c, s.id, e.target.value))} />
                      {editavel && (
                        <BotaoIcone titulo={`Remover setor ${s.nome}`} perigo onClick={() => mudar((c) => removerSetor(c, s.id))}>
                          <Trash2 className="size-4" />
                        </BotaoIcone>
                      )}
                    </div>
                  ))}
                {editavel && <NovoPorNome rotulo={`Novo setor em ${a.nome}`} botao="Setor" aoCriar={(n) => mudar((c) => adicionarSetor(c, a.id, n, novoId).config)} />}
              </div>
            </div>
          );
        })}
        {editavel && <NovoPorNome rotulo="Nome do novo ambiente" botao="Ambiente" aoCriar={(n) => mudar((c) => adicionarAmbiente(c, n, novoId).config)} />}
      </Card>

      <Card className="flex flex-col gap-4 p-4" role="region" aria-label="Painéis">
        <div>
          <h2 className="font-medium text-grafite-900">Painéis</h2>
          <p className="text-sm text-gray-500">Cada item do projeto pode ser ligado a um painel.</p>
        </div>
        {paineis.length === 0 && <p className="text-sm text-gray-500">Nenhum painel no projeto.</p>}
        {paineis.map((p) => (
          <fieldset key={p.id} disabled={!editavel} className="@container flex flex-col gap-3 rounded-lg border border-gray-200 p-3" data-painel={p.identificacao}>
            <div className="grid gap-3 @lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_7rem_auto] @lg:items-end">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-grafite-700">Identificação</span>
                <Input value={p.identificacao} maxLength={120} onChange={(e) => mudar((c) => atualizarPainel(c, p.id, { identificacao: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-grafite-700">Tipo de painel</span>
                <Select value={p.tipoId ?? ""} onChange={(e) => mudar((c) => atualizarPainel(c, p.id, { tipoId: e.target.value || null }))}>
                  <option value="">Escolha…</option>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                      {!t.ativo ? " (indisponível)" : ""}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-grafite-700">Tensão (V)</span>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={p.tensao ?? ""}
                  onChange={(e) => mudar((c) => atualizarPainel(c, p.id, { tensao: e.target.value === "" ? null : Number(e.target.value) }))}
                />
              </label>
              {editavel && (
                <BotaoIcone titulo={`Remover painel ${p.identificacao}`} perigo onClick={() => mudar((c) => removerPainel(c, p.id))}>
                  <Trash2 className="size-4" />
                </BotaoIcone>
              )}
            </div>
            {ambientes.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="text-gray-500">Atende:</span>
                {ambientes.map((a) => (
                  <label key={a.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-marca-600"
                      checked={p.ambientes.includes(a.id)}
                      onChange={(e) =>
                        mudar((c) =>
                          atualizarPainel(c, p.id, {
                            ambientes: e.target.checked ? [...p.ambientes, a.id] : p.ambientes.filter((x) => x !== a.id),
                          }),
                        )
                      }
                    />
                    {a.nome}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">{config.instancias.filter((i) => i.painelId === p.id).length} item(ns) ligado(s) a este painel.</p>
          </fieldset>
        ))}
        {editavel && <NovoPorNome rotulo="Identificação do novo painel" botao="Painel" aoCriar={(n) => mudar((c) => adicionarPainel(c, n, novoId).config)} />}
        {biblioteca.tiposDePainel.length === 0 && (
          <p className="text-xs text-amber-700">Nenhum tipo de painel cadastrado. Peça à equipe de automação para cadastrá-los.</p>
        )}
      </Card>
    </div>
  );
}

export function PainelDeGrupos({
  config,
  mudar,
  biblioteca,
  estrutura,
  editavel,
  nomeDaInstancia,
}: {
  config: ConfiguracaoDoProjeto;
  mudar: Mudar;
  biblioteca: BibliotecaDoConfigurador;
  estrutura: ResultadoDaEstrutura;
  editavel: boolean;
  nomeDaInstancia: (id: string) => string;
}) {
  const grupos = config.grupos ?? [];
  const funcoes = biblioteca.funcoes.filter((f) => f.ativo || grupos.some((g) => g.funcaoId === f.id));
  const emGrupos = new Map<string, number>();
  for (const g of grupos) for (const m of g.membros) emGrupos.set(m.instanciaId, (emGrupos.get(m.instanciaId) ?? 0) + m.quantidade);

  return (
    <Card className="flex flex-col gap-4 p-4" role="region" aria-label="Grupos de controle">
      <div>
        <h2 className="font-medium text-grafite-900">Grupos de controle</h2>
        <p className="text-sm text-gray-500">
          Equipamentos controlados juntos, por uma mesma função. Um grupo aceita modelos diferentes. Grupos não mudam a contagem de equipamentos, acionamentos ou proteções.
        </p>
      </div>
      {grupos.length === 0 && <p className="text-sm text-gray-500">Nenhum grupo de controle.</p>}
      <div className="grid gap-4 2xl:grid-cols-2">
        {grupos.map((g) => {
          const unidades = estrutura.grupos.find((x) => x.grupoId === g.id)?.unidades ?? 0;
          return (
            <fieldset key={g.id} disabled={!editavel} className="@container flex flex-col gap-3 rounded-lg border border-gray-200 p-3" data-grupo={g.nome}>
              <div className="grid gap-3 @lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] @lg:items-end">
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-grafite-700">Nome do grupo</span>
                  <Input value={g.nome} maxLength={120} onChange={(e) => mudar((c) => atualizarGrupo(c, g.id, { nome: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-medium text-grafite-700">Função de controle</span>
                  <Select value={g.funcaoId ?? ""} onChange={(e) => mudar((c) => atualizarGrupo(c, g.id, { funcaoId: e.target.value || null }))}>
                    <option value="">Escolha…</option>
                    {funcoes.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome}
                        {!f.ativo ? " (indisponível)" : ""}
                      </option>
                    ))}
                  </Select>
                </label>
                {editavel && (
                  <BotaoIcone titulo={`Remover grupo ${g.nome}`} perigo onClick={() => mudar((c) => removerGrupo(c, g.id))}>
                    <Trash2 className="size-4" />
                  </BotaoIcone>
                )}
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Membros</span>
                <Badge tom={unidades > 0 ? "marca" : "aviso"}>{unidades} unidade(s)</Badge>
              </div>
              {config.instancias.length === 0 && <p className="text-sm text-gray-500">Adicione itens ao projeto primeiro.</p>}
              <ul className="flex flex-col gap-1.5">
                {config.instancias.map((i) => {
                  const membro = g.membros.find((m) => m.instanciaId === i.id)?.quantidade ?? 0;
                  const livres = Math.max(0, (Number.isInteger(i.quantidade) ? i.quantidade : 0) - (emGrupos.get(i.id) ?? 0) + membro);
                  return (
                    <li key={i.id} className="flex items-center gap-3 text-sm">
                      <span className="min-w-0 flex-1 truncate">
                        {nomeDaInstancia(i.id)} <span className="text-xs text-gray-500">({i.quantidade} un.)</span>
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={livres}
                        step={1}
                        className="w-24"
                        aria-label={`Unidades de ${nomeDaInstancia(i.id)} em ${g.nome}`}
                        value={membro}
                        onChange={(e) => mudar((c) => definirMembro(c, g.id, i.id, Number(e.target.value)))}
                      />
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          );
        })}
      </div>
      {estrutura.foraDeGrupo.length > 0 && (
        <p className="text-sm text-amber-700">
          Fora de grupo: {estrutura.foraDeGrupo.map((f) => `${f.quantidade}× ${nomeDaInstancia(f.instanciaId)}`).join(", ")}.
        </p>
      )}
      {editavel && <NovoPorNome rotulo="Nome do novo grupo" botao="Grupo" aoCriar={(n) => mudar((c) => adicionarGrupo(c, n, novoId).config)} />}
      {biblioteca.funcoes.length === 0 && (
        <p className="text-xs text-amber-700">Nenhuma função de controle cadastrada. Peça à equipe de automação para cadastrá-las.</p>
      )}
    </Card>
  );
}
