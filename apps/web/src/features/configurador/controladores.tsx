"use client";
import { useState } from "react";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import {
  adicionarControlador,
  atualizarControlador,
  definirSaidaDoGrupo,
  ligarGrupoAoControlador,
  ligarInstanciaAoControlador,
  removerControlador,
  type ConfiguracaoDoProjeto,
  type ReservaTecnica,
  type ResultadoDosControladores,
} from "@zanatta/engine";
import { Badge, Card } from "@/ui/card";
import { Button } from "@/ui/button";
import { Campo, Input, Select } from "@/ui/input";
import { BotaoIcone } from "@/ui/acoes-de-linha";
import type { BibliotecaDoConfigurador } from "./tipos";

type Mudar = (f: (c: ConfiguracaoDoProjeto) => ConfiguracaoDoProjeto) => void;

/** Aba "Controladores": escolha, ligação de grupos e itens, distribuição de saídas e recursos. */
export function PainelDeControladores({
  config,
  mudar,
  biblioteca,
  resultado,
  editavel,
  nomeDaInstancia,
  podeAjustarReserva = false,
}: {
  config: ConfiguracaoDoProjeto;
  mudar: Mudar;
  biblioteca: BibliotecaDoConfigurador;
  resultado: ResultadoDosControladores;
  editavel: boolean;
  nomeDaInstancia: (id: string) => string;
  podeAjustarReserva?: boolean;
}) {
  const [nome, setNome] = useState("");
  const biblio = biblioteca.snapshot.controladores ?? {};
  const funcoes = new Map(biblioteca.funcoes.map((f) => [f.id, f.nome]));
  const cps = config.controladores ?? [];
  const grupos = config.grupos ?? [];
  const nomeDoCp = new Map(cps.map((c) => [c.id, c.nome]));
  const emGrupoComControlador = new Set(grupos.filter((g) => g.controladorId).flatMap((g) => g.membros.filter((m) => m.quantidade > 0).map((m) => m.instanciaId)));
  const criar = () => {
    const texto = nome.trim() || `Controlador ${cps.length + 1}`;
    mudar((c) => adicionarControlador(c, crypto.randomUUID(), texto, c.paineis?.length === 1 ? c.paineis[0]!.id : null));
    setNome("");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-4" role="region" aria-label="Controladores do projeto">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-medium text-grafite-900">Controladores do projeto</h2>
            <p className="text-sm text-gray-500">
              Cada grupo de controle ocupa uma saída funcional. Os recursos são somados por controlador. Só aparecem como compatíveis os que
              atendem funções, recursos e compatibilidade.
            </p>
          </div>
          {editavel && (
            <div className="flex gap-2">
              <Input
                aria-label="Nome do novo controlador"
                placeholder={`Controlador ${cps.length + 1}`}
                value={nome}
                maxLength={120}
                onChange={(e) => setNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    criar();
                  }
                }}
              />
              <Button type="button" variante="secundario" onClick={criar}>
                <Plus className="size-4" /> Controlador
              </Button>
            </div>
          )}
        </div>
        <ReservaDoProjeto
          reserva={config.reserva ?? null}
          padrao={biblioteca.snapshot.reservaPadrao ?? null}
          editavel={editavel && podeAjustarReserva}
          aoMudar={(reserva) => mudar((c) => ({ ...c, reserva }))}
        />
        {Object.keys(biblio).length === 0 && (
          <p className="mt-3 text-sm text-amber-700">Nenhum controlador cadastrado na biblioteca ainda. Peça à equipe técnica.</p>
        )}
      </Card>

      {cps.map((cp) => {
        const a = resultado.porControlador.find((x) => x.id === cp.id);
        const escolhido = cp.controladorId ? biblio[cp.controladorId] : undefined;
        const status = !cp.controladorId ? "pendente" : a?.compativel ? "ok" : "erro";
        return (
          <Card key={cp.id} className="overflow-hidden" role="region" aria-label={`Controlador ${cp.nome}`}>
            <div className="@container border-b border-gray-100 p-4">
              <div className="grid items-end gap-3 @3xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto]">
                <Campo rotulo="Nome no projeto">
                  <Input value={cp.nome} maxLength={120} disabled={!editavel} onChange={(e) => mudar((c) => atualizarControlador(c, cp.id, { nome: e.target.value }))} />
                </Campo>
                <Campo rotulo="Modelo do controlador">
                  <Select
                    value={cp.controladorId ?? ""}
                    disabled={!editavel}
                    onChange={(e) => mudar((c) => atualizarControlador(c, cp.id, { controladorId: e.target.value || null }))}
                  >
                    <option value="">Escolha…</option>
                    {(a?.alternativas ?? []).map((alt) => {
                      const c = biblio[alt.controladorId];
                      if (!c) return null;
                      return (
                        <option key={alt.controladorId} value={alt.controladorId}>
                          {alt.compativel ? `✓ ${c.nome}` : `${c.nome} (incompatível)`}
                        </option>
                      );
                    })}
                    {escolhido && !a?.alternativas.some((x) => x.controladorId === escolhido.id) && <option value={escolhido.id}>{escolhido.nome} (inativo)</option>}
                  </Select>
                </Campo>
                <Campo rotulo="Painel do controlador">
                  <Select value={cp.painelId ?? ""} disabled={!editavel} onChange={(e) => mudar((c) => atualizarControlador(c, cp.id, { painelId: e.target.value || null }))}>
                    <option value="">Sem painel</option>
                    {(config.paineis ?? []).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.identificacao}
                      </option>
                    ))}
                  </Select>
                </Campo>
                {editavel && (
                  <div className="pb-1">
                    <BotaoIcone titulo={`Remover ${cp.nome}`} perigo onClick={() => mudar((c) => removerControlador(c, cp.id))}>
                      <Trash2 className="size-4" />
                    </BotaoIcone>
                  </div>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2" data-status={status}>
                {status === "ok" && (
                  <Badge tom="marca">
                    <CheckCircle2 className="mr-1 size-3.5" /> Compatível
                  </Badge>
                )}
                {status === "erro" && (
                  <Badge tom="aviso">
                    <XCircle className="mr-1 size-3.5" /> Incompatível
                  </Badge>
                )}
                {status === "pendente" && <Badge>Escolha o modelo</Badge>}
                {escolhido?.protocolos.length ? <span className="text-xs text-gray-500">Protocolos: {escolhido.protocolos.join(", ")}</span> : null}
              </div>
              {a?.motivos && a.motivos.length > 0 && (
                <ul className="mt-2 list-disc pl-5 text-sm text-red-700">
                  {a.motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-0 lg:grid-cols-2">
              <fieldset className="border-b border-gray-100 p-4 lg:border-r">
                <legend className="sr-only">Grupos de {cp.nome}</legend>
                <p className="mb-2 text-sm font-medium text-grafite-900">Grupos de controle</p>
                {grupos.length === 0 && <p className="text-sm text-gray-500">Crie grupos na aba Grupos de controle.</p>}
                <div className="flex flex-col gap-1.5">
                  {grupos.map((g) => {
                    const outro = g.controladorId && g.controladorId !== cp.id ? nomeDoCp.get(g.controladorId) : null;
                    return (
                      <label key={g.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="accent-marca-600"
                          disabled={!editavel}
                          checked={g.controladorId === cp.id}
                          onChange={(e) => mudar((c) => ligarGrupoAoControlador(c, g.id, e.target.checked ? cp.id : null))}
                        />
                        <span>
                          {g.nome}
                          <span className="text-xs text-gray-500">
                            {" "}
                            · {g.funcaoId ? (funcoes.get(g.funcaoId) ?? "função removida") : "sem função"}
                            {outro ? ` · hoje em ${outro}` : ""}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
                <p className="mb-2 mt-4 text-sm font-medium text-grafite-900">Itens ligados direto</p>
                <p className="mb-2 text-xs text-gray-500">Sensores e itens fora de grupo que enviam ou recebem sinais deste controlador.</p>
                <div className="flex flex-col gap-1.5">
                  {config.instancias
                    .filter((i) => !emGrupoComControlador.has(i.id))
                    .map((i) => {
                      const outro = i.controladorId && i.controladorId !== cp.id ? nomeDoCp.get(i.controladorId) : null;
                      return (
                        <label key={i.id} className="flex items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            className="accent-marca-600"
                            disabled={!editavel}
                            checked={i.controladorId === cp.id}
                            onChange={(e) => mudar((c) => ligarInstanciaAoControlador(c, i.id, e.target.checked ? cp.id : null))}
                          />
                          <span>
                            {i.quantidade}× {nomeDaInstancia(i.id)}
                            {outro && <span className="text-xs text-gray-500"> · hoje em {outro}</span>}
                          </span>
                        </label>
                      );
                    })}
                </div>
              </fieldset>

              <div className="flex flex-col gap-4 border-b border-gray-100 p-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-grafite-900">Distribuição das saídas funcionais</p>
                  {!escolhido ? (
                    <p className="text-sm text-gray-500">Escolha o modelo do controlador.</p>
                  ) : !a?.distribuicao?.length ? (
                    <p className="text-sm text-gray-500">Nenhum grupo com função ligado a este controlador.</p>
                  ) : (
                    <table className="w-full text-sm" aria-label={`Distribuição de ${cp.nome}`}>
                      <thead className="text-left text-xs text-gray-500">
                        <tr>
                          <th className="py-1 font-medium">Grupo</th>
                          <th className="py-1 font-medium">Saída</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.distribuicao.map((d) => {
                          const g = grupos.find((x) => x.id === d.grupoId);
                          const opcoes = escolhido.saidas.filter((s) => g?.funcaoId && s.funcoes.includes(g.funcaoId));
                          return (
                            <tr key={d.grupoId} className="border-t border-gray-100" data-grupo={g?.nome} data-saida={d.saidaCodigo ?? ""}>
                              <td className="py-1.5 pr-2">
                                {g?.nome}
                                <span className="block text-xs text-gray-500">{g?.funcaoId ? funcoes.get(g.funcaoId) : ""}</span>
                              </td>
                              <td className="py-1.5">
                                <Select
                                  aria-label={`Saída do grupo ${g?.nome}`}
                                  value={d.manual ? (d.saidaId ?? "") : ""}
                                  disabled={!editavel}
                                  onChange={(e) => mudar((c) => definirSaidaDoGrupo(c, cp.id, d.grupoId, e.target.value || null))}
                                >
                                  <option value="">Automático{!d.manual && d.saidaCodigo ? ` (${d.saidaCodigo})` : d.saidaCodigo ? "" : " (sem saída)"}</option>
                                  {opcoes.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.codigo}
                                    </option>
                                  ))}
                                </Select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {escolhido && escolhido.saidas.length > 0 && a?.distribuicao && (
                    <p className="mt-2 text-xs text-gray-500">
                      Livres:{" "}
                      {escolhido.saidas
                        .filter((s) => !a.distribuicao!.some((d) => d.saidaId === s.id))
                        .map((s) => s.codigo)
                        .join(", ") || "nenhuma"}
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-grafite-900">Recursos e expansão</p>
                  {!a?.expansao?.necessidade.length ? (
                    <p className="text-sm text-gray-500">{escolhido ? "Nenhum sinal ligado a este controlador." : "Escolha o modelo do controlador."}</p>
                  ) : (
                    <table className="w-full text-sm" aria-label={`Recursos de ${cp.nome}`}>
                      <thead className="text-left text-xs text-gray-500">
                        <tr>
                          <th className="py-1 font-medium">Recurso</th>
                          <th className="py-1 text-right font-medium">Precisa</th>
                          <th className="py-1 text-right font-medium">Reserva</th>
                          <th className="py-1 text-right font-medium">Integrado</th>
                          <th className="py-1 text-right font-medium">Expansão</th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.expansao.necessidade.map((r) => (
                          <tr key={r.tipoRecursoId} className="border-t border-gray-100" data-recurso={r.codigo}>
                            <td className="py-1.5">{r.codigo}</td>
                            <td className="py-1.5 text-right tabular-nums" data-campo="necessario">
                              {r.necessario}
                            </td>
                            <td className="py-1.5 text-right tabular-nums" data-campo="reserva">
                              {r.reserva}
                            </td>
                            <td className="py-1.5 text-right tabular-nums">{r.integrado}</td>
                            <td className={`py-1.5 text-right tabular-nums ${r.deficit > 0 ? "font-medium text-amber-700" : ""}`} data-campo="deficit">
                              {r.deficit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                {escolhido && a?.expansao && a.expansao.alternativas.length > 0 && (
                  <div role="group" aria-label={`Cartões de ${cp.nome}`}>
                    <p className="mb-2 text-sm font-medium text-grafite-900">
                      {a.expansao.alternativas.length === 1 ? "Cartões de expansão" : `Escolha os cartões (${a.expansao.alternativas.length} opções)`}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {a.expansao.alternativas.map((alt, n) => {
                        const ativa = a.expansao!.escolhida?.chave === alt.chave;
                        return (
                          <div
                            key={alt.chave}
                            data-alternativa={n + 1}
                            data-escolhida={ativa ? "sim" : "nao"}
                            className={`rounded-lg border p-3 text-sm ${ativa ? "border-marca-500 bg-marca-50/50" : "border-gray-200"}`}
                          >
                            <ul className="mb-2">
                              {alt.cartoes.map((k) => (
                                <li key={k.cartaoId}>
                                  {k.quantidade}× {biblioteca.snapshot.cartoes?.[k.cartaoId]?.nome ?? "cartão"}
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs text-gray-500">
                              {alt.modulos} módulo(s) · {alt.excedente} ponto(s) sobrando
                              {alt.consumo != null ? ` · ${alt.consumo} mA` : " · consumo incompleto"}
                            </p>
                            {ativa ? (
                              <p className="mt-2 text-xs font-medium text-marca-700">{a.expansao!.automatica ? "Única opção, escolhida sozinha" : "Escolhida"}</p>
                            ) : (
                              editavel && (
                                <Button
                                  type="button"
                                  tamanho="sm"
                                  variante="secundario"
                                  className="mt-2"
                                  onClick={() =>
                                    mudar((c) =>
                                      atualizarControlador(c, cp.id, { cartoes: Object.fromEntries(alt.cartoes.map((k) => [k.cartaoId, k.quantidade])) }),
                                    )
                                  }
                                >
                                  Escolher opção {n + 1}
                                </Button>
                              )
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      {resultado.sinaisSemControlador.length > 0 && cps.length > 0 && (
        <Card className="p-4" role="region" aria-label="Sinais sem controlador">
          <p className="text-sm text-amber-800">
            Sinais sem controlador: {resultado.sinaisSemControlador.map((s) => `${s.quantidade} ${s.codigo}`).join(", ")}. Ligue os grupos ou itens a
            um controlador.
          </p>
        </Card>
      )}
    </div>
  );
}

const CODIGOS = ["DI", "DO", "AI", "AO"] as const;

/** Reserva técnica do projeto: padrão global ou ajuste do administrador técnico (§30). */
function ReservaDoProjeto({
  reserva,
  padrao,
  editavel,
  aoMudar,
}: {
  reserva: ReservaTecnica | null;
  padrao: ReservaTecnica | null;
  editavel: boolean;
  aoMudar: (r: ReservaTecnica | null) => void;
}) {
  const vigente = reserva ?? padrao ?? { modo: "nenhuma" as const, valores: {} };
  const descricao =
    vigente.modo === "nenhuma"
      ? "sem reserva"
      : CODIGOS.filter((c) => (vigente.valores[c] ?? 0) > 0)
          .map((c) => `${c} ${vigente.valores[c]}${vigente.modo === "percentual" ? "%" : ""}`)
          .join(", ") || "sem reserva";
  return (
    <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm" role="group" aria-label="Reserva técnica do projeto">
      <p className="text-grafite-800">
        Reserva técnica: <span className="font-medium">{descricao}</span>
        <span className="text-xs text-gray-500"> · {reserva ? "ajustada neste projeto" : "padrão das configurações"}</span>
      </p>
      {editavel && (
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <Campo rotulo="Modo da reserva do projeto">
            <Select
              value={reserva ? reserva.modo : "padrao"}
              onChange={(e) => aoMudar(e.target.value === "padrao" ? null : { modo: e.target.value as ReservaTecnica["modo"], valores: reserva?.valores ?? padrao?.valores ?? {} })}
            >
              <option value="padrao">Usar o padrão</option>
              <option value="nenhuma">Sem reserva</option>
              <option value="percentual">Percentual (%)</option>
              <option value="fixa">Quantidade fixa</option>
            </Select>
          </Campo>
          {reserva &&
            reserva.modo !== "nenhuma" &&
            CODIGOS.map((c) => (
              <Campo key={c} rotulo={`Reserva do projeto ${c}`}>
                <Input
                  className="w-20"
                  type="number"
                  min={0}
                  value={reserva.valores[c] ?? 0}
                  onChange={(e) => aoMudar({ ...reserva, valores: { ...reserva.valores, [c]: Math.max(0, Number(e.target.value) || 0) } })}
                />
              </Campo>
            ))}
        </div>
      )}
    </div>
  );
}
