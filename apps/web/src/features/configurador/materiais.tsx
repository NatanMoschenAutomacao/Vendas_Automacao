"use client";
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import type { AjusteManual, ConfiguracaoDoProjeto, LinhaDeMaterial, OrigemDaLinha, ResultadoDeMateriais } from "@zanatta/engine";
import { Badge, Card } from "@/ui/card";
import { Button } from "@/ui/button";
import { Campo, Input, Select } from "@/ui/input";
import { BotaoIcone } from "@/ui/acoes-de-linha";
import type { BibliotecaDoConfigurador } from "./tipos";

type Mudar = (f: (c: ConfiguracaoDoProjeto) => ConfiguracaoDoProjeto) => void;
const novoId = () => crypto.randomUUID();
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });

const ROTULO_AJUSTE: Record<AjusteManual["acao"], string> = {
  quantidade: "Quantidade alterada",
  remover: "Linha removida",
  adicionar: "Item avulso",
};

/** Formulário curto de quantidade e justificativa (ajustar/remover uma linha). */
function FormDeAjuste({
  linha,
  remover,
  aoConfirmar,
  aoCancelar,
}: {
  linha: LinhaDeMaterial;
  remover: boolean;
  aoConfirmar: (quantidade: number | null, justificativa: string) => void;
  aoCancelar: () => void;
}) {
  const [quantidade, setQuantidade] = useState(String(linha.quantidade));
  const [justificativa, setJustificativa] = useState("");
  const q = Number(quantidade.replace(",", "."));
  const valido = justificativa.trim().length >= 3 && (remover || (Number.isFinite(q) && q >= 0));
  return (
    <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-2" role="group" aria-label={remover ? "Remover linha" : "Ajustar quantidade"}>
      {!remover && (
        <Campo rotulo="Nova quantidade">
          <Input className="w-28" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </Campo>
      )}
      <div className="min-w-56 flex-1">
        <Campo rotulo="Justificativa" ajuda="Obrigatória. Fica registrada no orçamento.">
          <Input value={justificativa} maxLength={500} onChange={(e) => setJustificativa(e.target.value)} />
        </Campo>
      </div>
      <div className="flex gap-2 pb-5">
        <Button type="button" tamanho="sm" disabled={!valido} onClick={() => aoConfirmar(remover ? null : q, justificativa.trim())}>
          {remover ? "Remover linha" : "Aplicar ajuste"}
        </Button>
        <Button type="button" tamanho="sm" variante="fantasma" onClick={aoCancelar}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** Aba "Materiais": lista consolidada, origens, I/O por painel e ajustes manuais. */
export function PainelDeMateriais({
  config,
  mudar,
  biblioteca,
  materiais,
  editavel,
  nomeDaInstancia,
}: {
  config: ConfiguracaoDoProjeto;
  mudar: Mudar;
  biblioteca: BibliotecaDoConfigurador;
  materiais: ResultadoDeMateriais;
  editavel: boolean;
  nomeDaInstancia: (id: string) => string;
}) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [editando, setEditando] = useState<{ chave: string; remover: boolean } | null>(null);
  const ajustes = config.ajustes ?? [];
  const porChave = new Map(materiais.linhas.map((l) => [l.chave, l]));
  const itens = biblioteca.snapshot.itens ?? {};
  const recursos = biblioteca.snapshot.tiposDeRecurso ?? {};
  const paineis = new Map((config.paineis ?? []).map((p) => [p.id, p.identificacao]));

  const descreverOrigem = (o: OrigemDaLinha) => {
    if (o.tipo === "ajuste") return "Ajuste manual";
    const onde = o.instanciaId
      ? nomeDaInstancia(o.instanciaId)
      : o.painelId
        ? `Painel ${paineis.get(o.painelId) ?? ""}`
        : o.grupoId
          ? `Grupo ${config.grupos?.find((g) => g.id === o.grupoId)?.nome ?? ""}`
          : o.setorId
            ? `Setor ${config.setores?.find((s) => s.id === o.setorId)?.nome ?? ""}`
            : o.ambienteId
              ? `Ambiente ${config.ambientes?.find((a) => a.id === o.ambienteId)?.nome ?? ""}`
              : "Projeto";
    if (o.tipo === "fornecimento") return `Fornecimento · ${onde}`;
    return `Regra ${o.regraCodigo ?? ""} · ${onde}${o.baseQuantidade != null ? ` · base ${fmt(o.baseQuantidade)}` : ""}`;
  };

  const descreverAjuste = (a: AjusteManual) => {
    if (a.acao === "adicionar") {
      const it = a.itemId ? itens[a.itemId] : undefined;
      return it ? `${it.codigo} — ${it.descricao}` : "Item não encontrado";
    }
    const l = a.chave ? porChave.get(a.chave) : undefined;
    if (l) return `${l.codigo} — ${l.descricao} (${descreverOrigem(l.origem)})`;
    const codigo = a.chave?.split(":").at(-1) ?? "";
    return `${codigo} (linha ${a.chave ?? "?"})`;
  };

  const aplicarAjuste = (linha: LinhaDeMaterial, remover: boolean, quantidade: number | null, justificativa: string) => {
    mudar((c) => ({
      ...c,
      ajustes: [
        ...(c.ajustes ?? []).filter((a) => !(a.chave === linha.chave && a.acao !== "adicionar")),
        { id: novoId(), acao: remover ? "remover" : "quantidade", chave: linha.chave, quantidade, justificativa },
      ],
    }));
    setEditando(null);
  };

  const ioPorPainel = new Map<string, Map<string, number>>();
  const colunas = new Set<string>();
  for (const r of materiais.io) {
    const k = r.painelId ?? "";
    const m = ioPorPainel.get(k) ?? new Map<string, number>();
    m.set(r.codigo, (m.get(r.codigo) ?? 0) + r.quantidade);
    ioPorPainel.set(k, m);
    colunas.add(r.codigo);
  }
  const ordemDosRecursos = Object.values(recursos).map((r) => r.codigo);
  const cols = [...colunas].sort((a, b) => ordemDosRecursos.indexOf(a) - ordemDosRecursos.indexOf(b));

  return (
    <div className="flex flex-col gap-6">
      <Card className="overflow-hidden" role="region" aria-label="Lista de materiais">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="font-medium text-grafite-900">Lista de materiais</h2>
          <span className="text-xs text-gray-500">{materiais.consolidado.length} item(ns)</span>
        </div>
        {materiais.consolidado.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">
            Nenhum material gerado. Os materiais vêm das regras cadastradas para os equipamentos, painéis e projeto.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-2 py-2 font-medium">Código</th>
                  <th className="px-2 py-2 font-medium">Descrição</th>
                  <th className="px-2 py-2 font-medium">Un.</th>
                  <th className="px-4 py-2 text-right font-medium">Quantidade</th>
                </tr>
              </thead>
              <tbody>
                {materiais.consolidado.map((c) => {
                  const k = `${c.itemId}|${c.unidade}`;
                  const aberto = abertos.has(k);
                  const ajustada = c.chaves.some((ch) => porChave.get(ch)?.ajustadaPor);
                  return (
                    <Fragment key={k}>
                      <tr className="border-t border-gray-100" data-codigo={c.codigo} data-quantidade={c.quantidade}>
                        <td className="px-2 py-2">
                          <BotaoIcone
                            titulo={aberto ? `Fechar origens de ${c.codigo}` : `Origens de ${c.codigo}`}
                            onClick={() => setAbertos((s) => {
                              const n = new Set(s);
                              if (n.has(k)) n.delete(k);
                              else n.add(k);
                              return n;
                            })}
                          >
                            {aberto ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                          </BotaoIcone>
                        </td>
                        <td className="px-2 py-2 font-mono text-xs">{c.codigo}</td>
                        <td className="px-2 py-2">
                          {c.descricao}
                          {ajustada && (
                            <Badge tom="aviso" className="ml-2">
                              Ajustado
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-2">{c.unidade}</td>
                        <td className="px-4 py-2 text-right font-medium tabular-nums">{fmt(c.quantidade)}</td>
                      </tr>
                      {aberto && (
                        <tr className="bg-gray-50/60">
                          <td />
                          <td colSpan={4} className="px-2 pb-3 pt-1">
                            <ul className="flex flex-col gap-1" aria-label={`Origens de ${c.codigo}`}>
                              {c.chaves.map((ch) => {
                                const l = porChave.get(ch);
                                if (!l) return null;
                                return (
                                  <li key={ch} className="rounded-md bg-white px-3 py-2 ring-1 ring-gray-100">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="min-w-0 flex-1 text-xs text-gray-600">{descreverOrigem(l.origem)}</span>
                                      <span className="text-sm tabular-nums">{fmt(l.quantidade)}</span>
                                      {editavel && l.origem.tipo !== "ajuste" && (
                                        <>
                                          <BotaoIcone titulo={`Ajustar quantidade de ${c.codigo}`} onClick={() => setEditando({ chave: ch, remover: false })}>
                                            <Pencil className="size-4" />
                                          </BotaoIcone>
                                          <BotaoIcone titulo={`Remover linha de ${c.codigo}`} perigo onClick={() => setEditando({ chave: ch, remover: true })}>
                                            <X className="size-4" />
                                          </BotaoIcone>
                                        </>
                                      )}
                                    </div>
                                    {editando?.chave === ch && (
                                      <FormDeAjuste
                                        linha={l}
                                        remover={editando.remover}
                                        aoCancelar={() => setEditando(null)}
                                        aoConfirmar={(q, j) => aplicarAjuste(l, editando.remover, q, j)}
                                      />
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden" role="region" aria-label="Lista de I/O">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="font-medium text-grafite-900">Recursos de automação (I/O)</h2>
          <p className="text-xs text-gray-500">Sem reserva técnica. A reserva e a escolha de CLP e cartões chegam na Fase 08.</p>
        </div>
        {cols.length === 0 ? (
          <p className="px-4 py-4 text-sm text-gray-500">Nenhum recurso gerado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Painel</th>
                  {cols.map((c) => (
                    <th key={c} className="px-3 py-2 text-right font-medium">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...ioPorPainel.entries()].map(([painelId, m]) => (
                  <tr key={painelId} className="border-t border-gray-100" data-painel={painelId ? paineis.get(painelId) : "sem-painel"}>
                    <td className="px-4 py-2">{painelId ? (paineis.get(painelId) ?? "Painel removido") : "Sem painel"}</td>
                    {cols.map((c) => (
                      <td key={c} className="px-3 py-2 text-right tabular-nums" data-recurso={c}>
                        {fmt(m.get(c) ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <details className="border-t border-gray-100 px-4 py-2 text-sm">
              <summary className="cursor-pointer text-gray-500">Sinais por origem ({materiais.sinais.length})</summary>
              <ul className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
                {materiais.sinais.map((s) => (
                  <li key={s.chave}>
                    <span className="font-mono">{s.codigo}</span> × {fmt(s.quantidade)}
                    {s.funcao ? ` · ${s.funcao}` : ""} · {descreverOrigem(s.origem)}
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden" role="region" aria-label="Ajustes manuais">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="font-medium text-grafite-900">Ajustes manuais</h2>
          <p className="text-xs text-gray-500">Toda alteração da lista automática fica registrada com justificativa, autor e data.</p>
        </div>
        {ajustes.length === 0 ? (
          <p className="px-4 py-3 text-sm text-gray-500">Nenhum ajuste.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {ajustes.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start gap-3 px-4 py-2.5 text-sm" data-ajuste={a.acao}>
                <div className="min-w-0 flex-1">
                  <p className="text-grafite-900">
                    <span className="font-medium">{ROTULO_AJUSTE[a.acao]}</span>
                    {a.acao !== "remover" && a.quantidade != null && ` (${fmt(a.quantidade)})`}: {descreverAjuste(a)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {a.justificativa}
                    {a.autor ? ` · ${a.autor}` : ""}
                    {a.data ? ` · ${new Date(a.data).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}
                  </p>
                </div>
                {editavel && (
                  <BotaoIcone
                    titulo="Excluir ajuste"
                    perigo
                    onClick={() => mudar((c) => ({ ...c, ajustes: (c.ajustes ?? []).filter((x) => x.id !== a.id) }))}
                  >
                    <Trash2 className="size-4" />
                  </BotaoIcone>
                )}
              </li>
            ))}
          </ul>
        )}
        {editavel && <FormItemAvulso itens={Object.values(itens).filter((i) => i.ativo)} mudar={mudar} />}
      </Card>
    </div>
  );
}

function FormItemAvulso({
  itens,
  mudar,
}: {
  itens: { id: string; codigo: string; descricao: string; unidade: string }[];
  mudar: Mudar;
}) {
  const [busca, setBusca] = useState("");
  const [itemId, setItemId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const [justificativa, setJustificativa] = useState("");
  const termo = busca.trim().toLowerCase();
  const filtrados = itens
    .filter((i) => !termo || i.codigo.toLowerCase().includes(termo) || i.descricao.toLowerCase().includes(termo))
    .slice(0, 50);
  const q = Number(quantidade.replace(",", "."));
  const valido = itemId !== "" && q > 0 && justificativa.trim().length >= 3;
  return (
    <div className="@container border-t border-gray-100 px-4 py-3" role="group" aria-label="Adicionar item avulso">
      <p className="mb-2 text-sm font-medium text-grafite-900">Adicionar item avulso</p>
      <div className="grid items-end gap-2 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_6rem]">
        <Campo rotulo="Buscar no catálogo">
          <Input value={busca} placeholder="Código ou descrição" onChange={(e) => setBusca(e.target.value)} />
        </Campo>
        <Campo rotulo="Item avulso">
          <Select value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Escolha… ({filtrados.length})</option>
            {filtrados.map((i) => (
              <option key={i.id} value={i.id}>
                {i.codigo} — {i.descricao} ({i.unidade})
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Quantidade avulsa">
          <Input inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
        </Campo>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Campo rotulo="Justificativa do item avulso">
            <Input value={justificativa} maxLength={500} onChange={(e) => setJustificativa(e.target.value)} />
          </Campo>
        </div>
        <Button
          type="button"
          variante="secundario"
          disabled={!valido}
          onClick={() => {
            mudar((c) => ({ ...c, ajustes: [...(c.ajustes ?? []), { id: novoId(), acao: "adicionar", itemId, quantidade: q, justificativa: justificativa.trim() }] }));
            setItemId("");
            setQuantidade("1");
            setJustificativa("");
          }}
        >
          Adicionar item
        </Button>
      </div>
    </div>
  );
}
