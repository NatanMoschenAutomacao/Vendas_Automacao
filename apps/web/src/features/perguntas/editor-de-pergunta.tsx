"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  analisarFormula,
  chaveDoRotulo,
  ErroDeFormula,
  ROTULO_TIPO_PERGUNTA,
  TIPOS_AUTOMATICOS,
  TIPOS_COM_OPCOES,
  TIPOS_DE_PERGUNTA,
  TIPOS_NUMERICOS,
  type DescricaoDeVariavel,
  type Pergunta,
  type TipoDePergunta,
} from "@zanatta/engine";
import { Campo, Input, Select } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CampoDeResposta } from "./campo-de-resposta";
import { ConstrutorDeCondicao } from "./construtor-de-condicao";
import type { DadosDaPergunta } from "./schema";

function Secao({ titulo, children, descricao }: { titulo: string; descricao?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-gray-100 pt-5 first:border-0 first:pt-0">
      <div>
        <h2 className="font-medium text-grafite-900">{titulo}</h2>
        {descricao && <p className="text-xs text-gray-500">{descricao}</p>}
      </div>
      {children}
    </section>
  );
}

const numeroOuNulo = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

export function EditorDePergunta({
  acao,
  inicial,
  dono,
  perguntasDoEquipamento,
  variaveis,
  atributos,
  novo,
}: {
  acao: (estado: EstadoDoFormulario, form: FormData) => Promise<EstadoDoFormulario>;
  inicial: DadosDaPergunta;
  dono: "equipamento" | "modelo";
  /** Perguntas do equipamento (base para Substituir/Ocultar no modelo). */
  perguntasDoEquipamento: Pergunta[];
  variaveis: DescricaoDeVariavel[];
  atributos: { chave: string; rotulo: string }[];
  novo: boolean;
}) {
  const [d, setD] = useState<DadosDaPergunta>(inicial);
  const [chaveManual, setChaveManual] = useState(!novo);
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  const set = <K extends keyof DadosDaPergunta>(k: K, v: DadosDaPergunta[K]) => setD((x) => ({ ...x, [k]: v }));
  const temOpcoes = TIPOS_COM_OPCOES.includes(d.tipo);
  const numerico = TIPOS_NUMERICOS.includes(d.tipo);
  const automatico = TIPOS_AUTOMATICOS.includes(d.tipo);
  const variaveisSemEla = variaveis.filter((v) => v.nome !== `resposta.${d.chave}`);
  const herdada = dono === "modelo" && d.modo !== "NOVA";

  let erroFormula: string | null = null;
  if (d.tipo === "CALCULADO" && d.formula?.trim()) {
    try {
      analisarFormula(d.formula);
    } catch (err) {
      erroFormula = err instanceof ErroDeFormula ? err.message : "Fórmula inválida.";
    }
  }

  const escolherBase = (chave: string) => {
    const b = perguntasDoEquipamento.find((p) => p.chave === chave);
    if (!b) return set("chave", chave);
    setD((x) => ({
      ...x,
      chave: b.chave,
      texto: b.texto,
      ajuda: b.ajuda ?? null,
      tipo: b.tipo,
      unidade: b.unidade ?? null,
      obrigatoria: b.obrigatoria,
      minimo: b.minimo ?? null,
      maximo: b.maximo ?? null,
      passo: b.passo ?? null,
      padrao: b.padrao ?? null,
      condicao: b.condicao ?? null,
      opcoes: b.opcoes.map((o) => ({ ...o, imagemUrl: o.imagemUrl ?? null, condicao: o.condicao ?? null })),
      atributo: b.atributo ?? null,
      formula: b.formula ?? null,
    }));
  };

  const previa: Pergunta = { ...d, ordem: 0, opcoes: d.opcoes.map((o) => ({ ...o })) };

  return (
    <form onSubmit={onSubmit} className="@container flex flex-col gap-6">
      {dono === "modelo" && (
        <Secao titulo="Herança" descricao="Como esta pergunta se relaciona com as perguntas do equipamento.">
          <div className="grid gap-4 @xl:grid-cols-2">
            <Campo rotulo="Modo" erro={e.modo}>
              <Select
                value={d.modo}
                onChange={(ev) => {
                  const modo = ev.target.value as DadosDaPergunta["modo"];
                  set("modo", modo);
                  if (modo !== "NOVA" && perguntasDoEquipamento[0] && !perguntasDoEquipamento.some((p) => p.chave === d.chave))
                    escolherBase(perguntasDoEquipamento[0].chave);
                }}
              >
                <option value="NOVA">Pergunta exclusiva do modelo</option>
                <option value="SUBSTITUIR" disabled={perguntasDoEquipamento.length === 0}>
                  Substituir pergunta do equipamento
                </option>
                <option value="OCULTAR" disabled={perguntasDoEquipamento.length === 0}>
                  Ocultar pergunta do equipamento
                </option>
              </Select>
            </Campo>
            {herdada && (
              <Campo rotulo="Pergunta do equipamento" erro={e.chave}>
                <Select value={d.chave} onChange={(ev) => escolherBase(ev.target.value)}>
                  {perguntasDoEquipamento.map((p) => (
                    <option key={p.chave} value={p.chave}>
                      {p.texto} ({p.chave})
                    </option>
                  ))}
                </Select>
              </Campo>
            )}
          </div>
        </Secao>
      )}

      {d.modo !== "OCULTAR" && (
        <>
          <Secao titulo="Pergunta">
            <div className="grid gap-4 @xl:grid-cols-[minmax(0,1fr)_14rem]">
              <Campo rotulo="Texto da pergunta" erro={e.texto}>
                <Input
                  value={d.texto}
                  maxLength={200}
                  required
                  onChange={(ev) => {
                    const texto = ev.target.value;
                    setD((x) => ({ ...x, texto, chave: chaveManual || herdada ? x.chave : chaveDoRotulo(texto) }));
                  }}
                />
              </Campo>
              <Campo rotulo="Chave" erro={herdada ? undefined : e.chave} ajuda={herdada ? "Herdada do equipamento." : "Usada nas regras: resposta.chave"}>
                <Input
                  value={d.chave}
                  maxLength={40}
                  readOnly={herdada}
                  className="font-mono"
                  onChange={(ev) => {
                    setChaveManual(true);
                    set("chave", ev.target.value.toLowerCase());
                  }}
                />
              </Campo>
            </div>
            <div className="grid gap-4 @xl:grid-cols-2">
              <Campo rotulo="Tipo de resposta" erro={e.tipo}>
                <Select
                  value={d.tipo}
                  onChange={(ev) => setD((x) => ({ ...x, tipo: ev.target.value as TipoDePergunta, padrao: null }))}
                >
                  {TIPOS_DE_PERGUNTA.map((t) => (
                    <option key={t} value={t}>
                      {ROTULO_TIPO_PERGUNTA[t]}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo rotulo="Unidade" erro={e.unidade} ajuda="Opcional. Ex.: m, kW, un">
                <Input value={d.unidade ?? ""} maxLength={20} onChange={(ev) => set("unidade", ev.target.value || null)} />
              </Campo>
            </div>
            <Campo rotulo="Texto de ajuda" erro={e.ajuda}>
              <Input value={d.ajuda ?? ""} maxLength={500} onChange={(ev) => set("ajuda", ev.target.value || null)} />
            </Campo>
            {!automatico && (
              <label className="flex items-center gap-2 text-sm text-grafite-700">
                <input type="checkbox" className="size-4 accent-marca-600" checked={d.obrigatoria} onChange={(ev) => set("obrigatoria", ev.target.checked)} />
                Resposta obrigatória
              </label>
            )}
          </Secao>

          {temOpcoes && (
            <Secao titulo="Opções" descricao="O valor é usado nas regras; o rótulo é o que o vendedor vê.">
              {e.opcoes && <p className="text-xs text-red-600">{e.opcoes}</p>}
              <div className="flex flex-col gap-2" role="list" aria-label="Opções">
                {d.opcoes.map((o, i) => (
                  <div key={i} role="listitem" className="flex flex-col gap-2 rounded-lg border border-gray-100 p-2">
                    <div className="flex items-center gap-2">
                      <Input
                        aria-label={`Rótulo da opção ${i + 1}`}
                        placeholder="Rótulo"
                        value={o.rotulo}
                        maxLength={120}
                        onChange={(ev) => {
                          const rotulo = ev.target.value;
                          set(
                            "opcoes",
                            d.opcoes.map((x, j) =>
                              j === i ? { ...x, rotulo, valor: x.valor && x.valor !== chaveDoRotulo(x.rotulo) ? x.valor : chaveDoRotulo(rotulo) } : x,
                            ),
                          );
                        }}
                      />
                      <Input
                        aria-label={`Valor da opção ${i + 1}`}
                        placeholder="valor"
                        className="w-40 font-mono"
                        value={o.valor}
                        maxLength={60}
                        onChange={(ev) => set("opcoes", d.opcoes.map((x, j) => (j === i ? { ...x, valor: ev.target.value } : x)))}
                      />
                      <button
                        type="button"
                        aria-label={`Remover opção ${i + 1}`}
                        onClick={() => set("opcoes", d.opcoes.filter((_, j) => j !== i))}
                        className="grid size-8 shrink-0 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-red-600"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {d.tipo === "SELECAO_IMAGEM" && (
                      <Input
                        aria-label={`Imagem da opção ${i + 1}`}
                        placeholder="Endereço da imagem (opcional)"
                        value={o.imagemUrl ?? ""}
                        maxLength={500}
                        onChange={(ev) => set("opcoes", d.opcoes.map((x, j) => (j === i ? { ...x, imagemUrl: ev.target.value || null } : x)))}
                      />
                    )}
                    <details open={Boolean(o.condicao)}>
                      <summary className="cursor-pointer text-xs text-gray-500">Disponibilidade da opção</summary>
                      <div className="pt-2">
                        <ConstrutorDeCondicao
                          valor={o.condicao ?? null}
                          variaveis={variaveisSemEla}
                          rotuloSempre="Sempre disponível"
                          rotuloQuando="Disponível somente quando…"
                          onChange={(c) => set("opcoes", d.opcoes.map((x, j) => (j === i ? { ...x, condicao: c } : x)))}
                        />
                      </div>
                    </details>
                  </div>
                ))}
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => set("opcoes", [...d.opcoes, { valor: "", rotulo: "", imagemUrl: null, condicao: null }])}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-marca-700 hover:bg-marca-50"
                >
                  <Plus className="size-3.5" /> Adicionar opção
                </button>
              </div>
            </Secao>
          )}

          {numerico && (
            <Secao titulo="Limites">
              <div className="grid gap-4 @xl:grid-cols-3">
                <Campo rotulo="Mínimo" erro={e.minimo}>
                  <Input type="number" step="any" value={d.minimo ?? ""} onChange={(ev) => set("minimo", numeroOuNulo(ev.target.value))} />
                </Campo>
                <Campo rotulo="Máximo" erro={e.maximo}>
                  <Input type="number" step="any" value={d.maximo ?? ""} onChange={(ev) => set("maximo", numeroOuNulo(ev.target.value))} />
                </Campo>
                <Campo rotulo="Passo" erro={e.passo}>
                  <Input type="number" step="any" value={d.passo ?? ""} onChange={(ev) => set("passo", numeroOuNulo(ev.target.value))} />
                </Campo>
              </div>
            </Secao>
          )}

          {d.tipo === "INFORMACAO" && (
            <Secao titulo="Informação do modelo" descricao="O vendedor vê o valor cadastrado no modelo, sem digitar.">
              <Campo rotulo="Característica" erro={e.atributo}>
                <Select value={d.atributo ?? ""} onChange={(ev) => set("atributo", ev.target.value || null)}>
                  <option value="">Escolha…</option>
                  {atributos.map((a) => (
                    <option key={a.chave} value={a.chave}>
                      {a.rotulo}
                    </option>
                  ))}
                </Select>
              </Campo>
            </Secao>
          )}

          {d.tipo === "CALCULADO" && (
            <Secao
              titulo="Fórmula"
              descricao="Ex.: arredCima(instancia.quantidade / resposta.qtd_grupos). Funções: min, max, arred, arredCima, arredBaixo, se(cond, a, b)."
            >
              <Campo rotulo="Fórmula" erro={e.formula ?? erroFormula ?? undefined}>
                <Input className="font-mono" value={d.formula ?? ""} maxLength={500} onChange={(ev) => set("formula", ev.target.value || null)} />
              </Campo>
              <p className="text-xs text-gray-500">
                Variáveis: {variaveisSemEla.map((v) => v.nome).join(", ") || "nenhuma"}
              </p>
            </Secao>
          )}

          {!automatico && (
            <Secao titulo="Resposta padrão" descricao="Opcional. Já vem preenchida para o vendedor.">
              <div className="max-w-xl">
                <CampoDeResposta
                  pergunta={{ ...previa, texto: "Padrão", obrigatoria: false, ajuda: null }}
                  opcoes={previa.opcoes}
                  valor={d.padrao}
                  onChange={(v) => set("padrao", v)}
                  erro={e.padrao}
                />
              </div>
              {d.padrao !== null && (
                <div>
                  <button type="button" className="text-xs text-gray-500 underline" onClick={() => set("padrao", null)}>
                    Limpar padrão
                  </button>
                </div>
              )}
            </Secao>
          )}

          <Secao titulo="Quando exibir" descricao="Monte a condição com blocos E, OU e NÃO.">
            {e.condicao && <p className="text-xs text-red-600">{e.condicao}</p>}
            <ConstrutorDeCondicao
              valor={d.condicao}
              variaveis={variaveisSemEla}
              rotuloSempre="Sempre exibir"
              rotuloQuando="Exibir somente quando…"
              onChange={(c) => set("condicao", c)}
            />
          </Secao>
        </>
      )}

      <input type="hidden" name="dados" value={JSON.stringify(d)} />
      <label className="flex items-center gap-2 text-sm text-grafite-700">
        <input type="checkbox" className="size-4 accent-marca-600" checked={d.ativo} onChange={(ev) => set("ativo", ev.target.checked)} />
        Pergunta ativa
      </label>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Salvar pergunta</BotaoEnviar>
      </div>
    </form>
  );
}
