"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import {
  adicionarAjusteComercial,
  adicionarServico,
  alterarQuantidadeDoServico,
  atualizarCondicoesComerciais,
  removerAjusteComercial,
  removerServico,
  type AjusteComercial,
  type ConfiguracaoDoProjeto,
  type ResultadoDePrecos,
} from "@zanatta/engine";
import { Badge, Card } from "@/ui/card";
import { Button } from "@/ui/button";
import { Campo, Input, Select } from "@/ui/input";
import { BotaoIcone } from "@/ui/acoes-de-linha";
import { dinheiro, numero, pct } from "@/features/precos/formato";
import { normalizarDecimal, ROTULO_GRUPO, ROTULO_MODO } from "@/features/precos/schema";
import { verificarLimiteDeDesconto } from "@/features/precos/limite";
import type { BibliotecaDoConfigurador } from "./tipos";

type Mudar = (f: (c: ConfiguracaoDoProjeto) => ConfiguracaoDoProjeto) => void;
const novoId = () => crypto.randomUUID();

const ROTULO_ESCOPO: Record<AjusteComercial["escopo"], string> = { ...ROTULO_GRUPO, total: "Total geral" };

export interface PermissoesComerciais {
  descontoLivre: boolean;
  limiteDeDesconto: string;
}

function FormDeAjusteComercial({ config, mudar, comercial }: { config: ConfiguracaoDoProjeto; mudar: Mudar; comercial: PermissoesComerciais }) {
  const [tipo, setTipo] = useState<AjusteComercial["tipo"]>("desconto");
  const [escopo, setEscopo] = useState<AjusteComercial["escopo"]>("total");
  const [modo, setModo] = useState<AjusteComercial["modo"]>("percentual");
  const [valor, setValor] = useState("");
  const [justificativa, setJustificativa] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const soPercentual = tipo === "desconto" && !comercial.descontoLivre;
  const aplicar = () => {
    const v = normalizarDecimal(valor);
    if (!v || v === "NaN" || Number(v) <= 0) return setErro("Informe um valor maior que zero.");
    if ((v.split(".")[1]?.length ?? 0) > 4) return setErro("Use no máximo 4 casas decimais.");
    if (justificativa.trim().length < 3) return setErro("Escreva a justificativa.");
    const novo: AjusteComercial = { id: novoId(), tipo, escopo, modo: soPercentual ? "percentual" : modo, valor: v, justificativa: justificativa.trim() };
    if (!comercial.descontoLivre) {
      const atuais = config.comercial?.ajustes ?? [];
      // A tela avisa antes; o servidor confere de novo ao salvar.
      const e = verificarLimiteDeDesconto([...atuais, novo], atuais, comercial.limiteDeDesconto);
      if (e) return setErro(e);
    }
    mudar((c) => adicionarAjusteComercial(c, novo));
    setValor("");
    setJustificativa("");
    setErro(null);
  };
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-gray-50 p-3" role="group" aria-label="Novo desconto ou acréscimo">
      <div className="grid gap-3 sm:grid-cols-4">
        <Campo rotulo="Tipo de ajuste">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as AjusteComercial["tipo"])}>
            <option value="desconto">Desconto</option>
            <option value="acrescimo">Acréscimo</option>
          </Select>
        </Campo>
        <Campo rotulo="Aplicar sobre">
          <Select value={escopo} onChange={(e) => setEscopo(e.target.value as AjusteComercial["escopo"])}>
            {Object.entries(ROTULO_ESCOPO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Forma do ajuste">
          <Select value={soPercentual ? "percentual" : modo} disabled={soPercentual} onChange={(e) => setModo(e.target.value as AjusteComercial["modo"])}>
            <option value="percentual">Percentual (%)</option>
            <option value="valor">Valor (R$)</option>
          </Select>
        </Campo>
        <Campo rotulo="Valor do ajuste">
          <Input inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="Justificativa do ajuste" ajuda={comercial.descontoLivre ? undefined : `Seu limite de desconto: ${pct(comercial.limiteDeDesconto)} em cada grupo e no total.`}>
        <Input value={justificativa} maxLength={500} onChange={(e) => setJustificativa(e.target.value)} />
      </Campo>
      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div>
        <Button type="button" tamanho="sm" onClick={aplicar}>
          Aplicar ajuste comercial
        </Button>
      </div>
    </div>
  );
}

function IncluirServico({ biblioteca, mudar }: { biblioteca: BibliotecaDoConfigurador; mudar: Mudar }) {
  const servicos = Object.values(biblioteca.snapshot.servicos ?? {}).filter((s) => s.ativo);
  const [servicoId, setServicoId] = useState("");
  const [quantidade, setQuantidade] = useState("1");
  const q = Number(quantidade.replace(",", "."));
  if (servicos.length === 0) return <p className="text-sm text-gray-500">Nenhum serviço cadastrado na biblioteca.</p>;
  return (
    <div className="flex flex-wrap items-end gap-2" role="group" aria-label="Incluir serviço">
      <div className="min-w-64 flex-1">
        <Campo rotulo="Serviço">
          <Select value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
            <option value="">Escolha…</option>
            {servicos.map((s) => (
              <option key={s.id} value={s.id}>
                {s.codigo} — {s.descricao} ({s.unidade})
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo rotulo="Quantidade do serviço">
        <Input className="w-28" inputMode="decimal" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
      </Campo>
      <div className="pb-0.5">
        <Button
          type="button"
          tamanho="sm"
          disabled={!servicoId || !(q > 0)}
          onClick={() => {
            mudar((c) => adicionarServico(c, novoId(), servicoId, q));
            setServicoId("");
            setQuantidade("1");
          }}
        >
          Incluir serviço
        </Button>
      </div>
    </div>
  );
}

/** Aba "Preços": valores por linha, serviços, descontos, impostos e totais (Fase 09). */
export function PainelDePrecos({
  config,
  mudar,
  biblioteca,
  precos,
  editavel,
  comercial,
}: {
  config: ConfiguracaoDoProjeto;
  mudar: Mudar;
  biblioteca: BibliotecaDoConfigurador;
  precos: ResultadoDePrecos;
  editavel: boolean;
  comercial: PermissoesComerciais;
}) {
  const verCusto = !precos.custosOcultos;
  const servicosDoSnapshot = biblioteca.snapshot.servicos ?? {};
  const grupos = new Set(precos.linhas.map((l) => l.grupo));
  const ajustes = config.comercial?.ajustes ?? [];

  return (
    <div className="flex flex-col gap-6">
      {precos.parcial && (
        <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          Há itens sem preço. Os totais abaixo são parciais e a emissão fica bloqueada até que o administrador cadastre os preços.
        </p>
      )}

      <Card className="overflow-x-auto" role="region" aria-label="Preços por linha">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Descrição</th>
              <th className="px-4 py-2 text-right">Qtd.</th>
              <th className="px-4 py-2">Un.</th>
              <th className="px-4 py-2 text-right">Unitário</th>
              <th className="px-4 py-2 text-right">Total</th>
              {verCusto && <th className="px-4 py-2 text-right">Custo total</th>}
            </tr>
          </thead>
          {(["material", "servico", "software"] as const)
            .filter((g) => grupos.has(g))
            .map((g) => (
              <tbody key={g} className="divide-y divide-gray-100" aria-label={ROTULO_GRUPO[g]}>
                <tr className="bg-gray-50/50">
                  <th colSpan={verCusto ? 7 : 6} className="px-4 py-1.5 text-left text-xs font-semibold text-grafite-700">
                    {ROTULO_GRUPO[g]}
                  </th>
                </tr>
                {precos.linhas
                  .filter((l) => l.grupo === g)
                  .map((l) => (
                    <tr key={l.chave} data-codigo={l.codigo} data-total={l.total ?? ""} data-sem-preco={l.semPreco ? "sim" : undefined}>
                      <td className="px-4 py-2 font-mono text-xs">{l.codigo}</td>
                      <td className="px-4 py-2">
                        {l.descricao}
                        {verCusto && l.modo && <span className="ml-2 text-xs text-gray-400">{ROTULO_MODO[l.modo]}</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{numero(l.quantidade)}</td>
                      <td className="px-4 py-2">{l.unidade}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{l.semPreco ? <Badge tom="aviso">Sem preço</Badge> : dinheiro(l.unitario)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{dinheiro(l.total)}</td>
                      {verCusto && <td className="px-4 py-2 text-right tabular-nums text-gray-500">{dinheiro(l.custoTotal)}</td>}
                    </tr>
                  ))}
              </tbody>
            ))}
          {precos.linhas.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={7} className="px-4 py-4 text-gray-500">
                  Nenhum material ou serviço ainda.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card className="p-5" role="region" aria-label="Serviços incluídos à mão">
            <h2 className="mb-1 font-medium text-grafite-900">Serviços incluídos à mão</h2>
            <p className="mb-3 text-sm text-gray-500">Serviços gerados por regra já aparecem na tabela. Aqui entram os serviços avulsos.</p>
            <ul className="mb-3 divide-y divide-gray-100">
              {(config.servicos ?? []).map((s) => {
                const sv = servicosDoSnapshot[s.servicoId];
                return (
                  <li key={s.id} className="flex items-center gap-2 py-2 text-sm" data-servico-manual={sv?.codigo ?? s.servicoId}>
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-xs">{sv?.codigo ?? "?"}</span> {sv?.descricao ?? "Serviço removido"}
                    </span>
                    <Input
                      className="h-8 w-24"
                      inputMode="decimal"
                      aria-label={`Quantidade de ${sv?.codigo ?? "serviço"}`}
                      defaultValue={String(s.quantidade).replace(".", ",")}
                      disabled={!editavel}
                      onBlur={(e) => {
                        const q = Number(e.target.value.replace(",", "."));
                        if (Number.isFinite(q) && q !== s.quantidade) mudar((c) => alterarQuantidadeDoServico(c, s.id, q));
                      }}
                    />
                    <span className="w-8 text-gray-500">{sv?.unidade}</span>
                    {editavel && (
                      <BotaoIcone titulo={`Remover serviço ${sv?.codigo ?? ""}`} perigo onClick={() => mudar((c) => removerServico(c, s.id))}>
                        <Trash2 className="size-4" />
                      </BotaoIcone>
                    )}
                  </li>
                );
              })}
            </ul>
            {editavel && <IncluirServico biblioteca={biblioteca} mudar={mudar} />}
          </Card>

          <Card className="p-5" role="region" aria-label="Descontos e acréscimos">
            <h2 className="mb-1 font-medium text-grafite-900">Descontos e acréscimos</h2>
            <p className="mb-3 text-sm text-gray-500">Aplicados depois da soma das linhas, por grupo ou sobre o total geral.</p>
            {ajustes.length === 0 && <p className="mb-3 text-sm text-gray-500">Nenhum ajuste comercial.</p>}
            <ul className="mb-3 divide-y divide-gray-100">
              {ajustes.map((a) => (
                <li key={a.id} className="flex items-center gap-2 py-2 text-sm" data-ajuste-comercial={a.id}>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">
                      {a.tipo === "desconto" ? "Desconto" : "Acréscimo"} de {a.modo === "percentual" ? pct(a.valor) : dinheiro(a.valor)} sobre {ROTULO_ESCOPO[a.escopo].toLowerCase()}
                    </span>
                    <span className="block text-xs text-gray-500">
                      {a.justificativa}
                      {a.autor ? ` · ${a.autor}` : ""}
                    </span>
                  </span>
                  {editavel && (
                    <BotaoIcone titulo="Remover ajuste comercial" perigo onClick={() => mudar((c) => removerAjusteComercial(c, a.id))}>
                      <Trash2 className="size-4" />
                    </BotaoIcone>
                  )}
                </li>
              ))}
            </ul>
            {editavel && <FormDeAjusteComercial config={config} mudar={mudar} comercial={comercial} />}
          </Card>

          <Card className="p-5" role="region" aria-label="Condições comerciais">
            <h2 className="mb-3 font-medium text-grafite-900">Condições comerciais</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["condicoesDePagamento", "Condições de pagamento"],
                  ["prazoDeEntrega", "Prazo de entrega"],
                  ["garantia", "Garantia"],
                  ["validade", "Validade da proposta"],
                ] as const
              ).map(([campo, rotulo]) => (
                <Campo key={campo} rotulo={rotulo}>
                  <Input
                    defaultValue={config.comercial?.[campo] ?? ""}
                    maxLength={1000}
                    disabled={!editavel}
                    onBlur={(e) => {
                      const v = e.target.value.trim() || null;
                      if (v !== (config.comercial?.[campo] ?? null)) mudar((c) => atualizarCondicoesComerciais(c, { [campo]: v }));
                    }}
                  />
                </Campo>
              ))}
            </div>
          </Card>
        </div>

        <Card className="h-fit p-5" role="region" aria-label="Totais">
          <h2 className="mb-3 font-medium text-grafite-900">Totais{precos.parcial && <Badge tom="aviso" className="ml-2">Parcial</Badge>}</h2>
          <dl className="flex flex-col gap-3 text-sm">
            {precos.grupos.map((g) => (
              <div key={g.grupo} className="rounded-lg border border-gray-100 p-3" data-grupo={g.grupo}>
                <div className="flex justify-between font-medium text-grafite-900">
                  <dt>
                    {ROTULO_GRUPO[g.grupo]}
                    {g.parcial && <span className="ml-1 text-xs font-normal text-amber-700">(parcial)</span>}
                  </dt>
                  <dd className="tabular-nums" data-campo="subtotal">
                    {dinheiro(g.subtotal)}
                  </dd>
                </div>
                {g.ajustes.map((a) => (
                  <div key={a.id} className="flex justify-between text-gray-600">
                    <dt>
                      {a.tipo === "desconto" ? "Desconto" : "Acréscimo"}
                      {a.percentual ? ` ${pct(a.percentual)}` : ""}
                    </dt>
                    <dd className="tabular-nums">{dinheiro(a.valor)}</dd>
                  </div>
                ))}
                {g.impostos.map((i) => (
                  <div key={i.id} className="flex justify-between text-gray-600">
                    <dt>
                      {i.nome} ({pct(i.percentual)})
                    </dt>
                    <dd className="tabular-nums">{dinheiro(i.valor)}</dd>
                  </div>
                ))}
                {(g.ajustes.length > 0 || g.impostos.length > 0) && (
                  <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 font-medium text-grafite-900">
                    <dt>Total de {ROTULO_GRUPO[g.grupo].toLowerCase()}</dt>
                    <dd className="tabular-nums" data-campo="total-do-grupo">
                      {dinheiro(g.total)}
                    </dd>
                  </div>
                )}
                {verCusto && g.custo && <p className="mt-1 text-xs text-gray-400">Custo: {dinheiro(g.custo)}</p>}
              </div>
            ))}
            {precos.ajustesGerais.map((a) => (
              <div key={a.id} className="flex justify-between text-gray-600">
                <dt>
                  {a.tipo === "desconto" ? "Desconto no total" : "Acréscimo no total"}
                  {a.percentual ? ` ${pct(a.percentual)}` : ""}
                </dt>
                <dd className="tabular-nums">{dinheiro(a.valor)}</dd>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-semibold text-grafite-900">
              <dt>{precos.parcial ? "Total geral (parcial)" : "Total geral"}</dt>
              <dd className="tabular-nums" data-campo="total-geral">
                {dinheiro(precos.total)}
              </dd>
            </div>
            {verCusto && (
              <div className="flex justify-between text-xs text-gray-500" data-campo="margem">
                <dt>Custo total · margem sobre a venda líquida</dt>
                <dd className="tabular-nums">
                  {dinheiro(precos.custoTotal)} · {pct(precos.margem)}
                </dd>
              </div>
            )}
          </dl>
          {precos.grupos.length === 0 && (
            <p className="text-sm text-gray-500">Os totais aparecem quando houver materiais ou serviços.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
