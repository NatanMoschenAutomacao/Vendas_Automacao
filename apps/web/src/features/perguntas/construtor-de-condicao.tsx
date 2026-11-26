"use client";
import { Plus, Trash2 } from "lucide-react";
import {
  OPERADORES,
  ROTULO_OPERADOR,
  type Condicao,
  type DescricaoDeVariavel,
  type Operador,
  type ValorSimples,
} from "@zanatta/engine";
import { cn } from "@/lib/cn";
import { Input, Select } from "@/ui/input";

type Comparacao = Extract<Condicao, { tipo: "comparacao" }>;
type Grupo = Extract<Condicao, { tipo: "e" | "ou" }>;

const NUMERICOS: Operador[] = ["maior", "maior_igual", "menor", "menor_igual", "entre"];

function operadoresPara(v?: DescricaoDeVariavel): Operador[] {
  if (!v) return ["igual"];
  return OPERADORES.filter((op) => {
    if (NUMERICOS.includes(op)) return v.tipo === "numero";
    if (op === "contem") return v.tipo === "multipla" || v.tipo === "texto";
    if (op === "em") return v.tipo !== "booleano";
    if (v.tipo === "multipla") return op === "preenchido";
    return true;
  });
}

function valorInicial(v: DescricaoDeVariavel | undefined, op: Operador): Comparacao["valor"] {
  if (op === "preenchido") return undefined;
  if (op === "entre") return [0, 0];
  if (op === "em") return [];
  if (v?.tipo === "booleano") return true;
  if (v?.tipo === "numero") return 0;
  return v?.opcoes?.[0] ?? "";
}

const novaComparacao = (variaveis: DescricaoDeVariavel[]): Comparacao => {
  const v = variaveis[0];
  const op = operadoresPara(v)[0]!;
  return { tipo: "comparacao", variavel: v?.nome ?? "", operador: op, valor: valorInicial(v, op) };
};

function CampoDeValor({ c, v, onChange }: { c: Comparacao; v?: DescricaoDeVariavel; onChange: (x: Comparacao["valor"]) => void }) {
  if (c.operador === "preenchido") return null;
  if (c.operador === "entre") {
    const [a, b] = Array.isArray(c.valor) ? c.valor : [0, 0];
    return (
      <div className="flex items-center gap-1.5">
        <Input type="number" aria-label="De" className="w-24" value={String(a ?? "")} onChange={(e) => onChange([Number(e.target.value), b ?? 0])} />
        <span className="text-xs text-gray-500">e</span>
        <Input type="number" aria-label="Até" className="w-24" value={String(b ?? "")} onChange={(e) => onChange([a ?? 0, Number(e.target.value)])} />
      </div>
    );
  }
  if (c.operador === "em") {
    const lista = (Array.isArray(c.valor) ? c.valor : []).map(String);
    if (v?.opcoes?.length) {
      return (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {v.opcoes.map((o) => (
            <label key={o} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                className="accent-marca-600"
                checked={lista.includes(o)}
                onChange={(e) => onChange(e.target.checked ? [...lista, o] : lista.filter((x) => x !== o))}
              />
              {o}
            </label>
          ))}
        </div>
      );
    }
    return (
      <Input
        aria-label="Valores separados por ponto e vírgula"
        placeholder="valor1; valor2"
        value={lista.join("; ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(";")
              .map((x) => x.trim())
              .filter(Boolean)
              .map((x) => (v?.tipo === "numero" ? Number(x.replace(",", ".")) : x)),
          )
        }
      />
    );
  }
  if (v?.tipo === "booleano") {
    return (
      <Select aria-label="Valor" value={c.valor === false ? "nao" : "sim"} onChange={(e) => onChange(e.target.value === "sim")}>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </Select>
    );
  }
  if (v?.opcoes?.length) {
    return (
      <Select aria-label="Valor" value={String(c.valor ?? "")} onChange={(e) => onChange(e.target.value)}>
        {v.opcoes.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>
    );
  }
  return (
    <Input
      aria-label="Valor"
      type={v?.tipo === "numero" ? "number" : "text"}
      value={String(c.valor ?? "")}
      onChange={(e) => onChange(v?.tipo === "numero" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
    />
  );
}

function LinhaDeComparacao({
  c,
  variaveis,
  onChange,
}: {
  c: Comparacao;
  variaveis: DescricaoDeVariavel[];
  onChange: (c: Comparacao) => void;
}) {
  const v = variaveis.find((x) => x.nome === c.variavel);
  const ops = operadoresPara(v);
  const grupos = [
    { titulo: "Respostas", itens: variaveis.filter((x) => x.nome.startsWith("resposta.")) },
    { titulo: "Modelo", itens: variaveis.filter((x) => x.nome.startsWith("modelo.")) },
    { titulo: "Instância", itens: variaveis.filter((x) => x.nome.startsWith("instancia.")) },
    { titulo: "Outros", itens: variaveis.filter((x) => !/^(resposta|modelo|instancia)\./.test(x.nome)) },
  ].filter((g) => g.itens.length);
  return (
    <div className="grid flex-1 gap-2 @2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
      <Select
        aria-label="Variável"
        value={c.variavel}
        onChange={(e) => {
          const nv = variaveis.find((x) => x.nome === e.target.value);
          const nops = operadoresPara(nv);
          const op = nops.includes(c.operador) ? c.operador : nops[0]!;
          onChange({ ...c, variavel: e.target.value, operador: op, valor: valorInicial(nv, op) });
        }}
      >
        {!v && <option value={c.variavel}>{c.variavel || "Escolha…"} (inexistente)</option>}
        {grupos.map((g) => (
          <optgroup key={g.titulo} label={g.titulo}>
            {g.itens.map((x) => (
              <option key={x.nome} value={x.nome}>
                {x.rotulo.replace(/^[^›]+› /, "")}
                {x.unidade ? ` (${x.unidade})` : ""}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      <Select
        aria-label="Operador"
        value={c.operador}
        onChange={(e) => {
          const op = e.target.value as Operador;
          onChange({ ...c, operador: op, valor: valorInicial(v, op) });
        }}
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {ROTULO_OPERADOR[op]}
          </option>
        ))}
      </Select>
      <CampoDeValor c={c} v={v} onChange={(valor) => onChange({ ...c, valor: valor as ValorSimples | ValorSimples[] })} />
    </div>
  );
}

function ItemDoGrupo({
  item,
  variaveis,
  onChange,
  onRemove,
  profundidade,
}: {
  item: Condicao;
  variaveis: DescricaoDeVariavel[];
  onChange: (c: Condicao) => void;
  onRemove: () => void;
  profundidade: number;
}) {
  const negado = item.tipo === "nao";
  const interno = negado ? item.item : item;
  const atualizar = (c: Condicao) => onChange(negado ? { tipo: "nao", item: c } : c);
  return (
    <div className="flex items-start gap-2">
      <button
        type="button"
        title="Inverter (NÃO)"
        onClick={() => onChange(negado ? interno : { tipo: "nao", item: interno })}
        className={cn(
          "mt-1.5 h-7 shrink-0 rounded-md border px-1.5 text-xs font-semibold",
          negado ? "border-red-200 bg-red-50 text-red-700" : "border-gray-200 text-gray-400 hover:text-grafite-700",
        )}
      >
        NÃO
      </button>
      {interno.tipo === "comparacao" ? (
        <LinhaDeComparacao c={interno} variaveis={variaveis} onChange={atualizar} />
      ) : interno.tipo === "nao" ? (
        <span className="text-sm text-gray-500">(negação dupla)</span>
      ) : (
        <BlocoDeGrupo grupo={interno} variaveis={variaveis} onChange={atualizar} profundidade={profundidade + 1} />
      )}
      <button
        type="button"
        title="Remover"
        aria-label="Remover condição"
        onClick={onRemove}
        className="mt-1.5 grid size-7 shrink-0 place-items-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-red-600"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
}

function BlocoDeGrupo({
  grupo,
  variaveis,
  onChange,
  profundidade,
}: {
  grupo: Grupo;
  variaveis: DescricaoDeVariavel[];
  onChange: (g: Grupo) => void;
  profundidade: number;
}) {
  const set = (itens: Condicao[]) => onChange({ ...grupo, itens });
  return (
    <div className={cn("flex flex-1 flex-col gap-2 rounded-lg border border-gray-200 p-3", profundidade % 2 === 1 && "bg-gray-50/70")}>
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
        Atender
        <Select
          aria-label="Combinação"
          className="h-8 w-auto"
          value={grupo.tipo}
          onChange={(e) => onChange({ ...grupo, tipo: e.target.value as "e" | "ou" })}
        >
          <option value="e">todas (E)</option>
          <option value="ou">qualquer uma (OU)</option>
        </Select>
        das condições:
      </div>
      {grupo.itens.map((it, i) => (
        <ItemDoGrupo
          key={i}
          item={it}
          variaveis={variaveis}
          profundidade={profundidade}
          onChange={(c) => set(grupo.itens.map((x, j) => (j === i ? c : x)))}
          onRemove={() => set(grupo.itens.filter((_, j) => j !== i))}
        />
      ))}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => set([...grupo.itens, novaComparacao(variaveis)])}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-marca-700 hover:bg-marca-50"
        >
          <Plus className="size-3.5" /> Condição
        </button>
        {profundidade < 4 && (
          <button
            type="button"
            onClick={() => set([...grupo.itens, { tipo: grupo.tipo === "e" ? "ou" : "e", itens: [novaComparacao(variaveis)] }])}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            <Plus className="size-3.5" /> Grupo
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Construtor visual de condições (blocos E, OU e NÃO). Produz a árvore JSON
 * do motor; nulo significa "sempre".
 */
export function ConstrutorDeCondicao({
  valor,
  onChange,
  variaveis,
  rotuloSempre = "Sempre",
  rotuloQuando = "Somente quando…",
}: {
  valor: Condicao | null;
  onChange: (c: Condicao | null) => void;
  variaveis: DescricaoDeVariavel[];
  rotuloSempre?: string;
  rotuloQuando?: string;
}) {
  const raiz: Grupo | null =
    valor === null ? null : valor.tipo === "e" || valor.tipo === "ou" ? valor : { tipo: "e", itens: [valor] };
  return (
    <div className="@container flex flex-col gap-3">
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input type="radio" className="accent-marca-600" checked={raiz === null} onChange={() => onChange(null)} />
          {rotuloSempre}
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            className="accent-marca-600"
            checked={raiz !== null}
            disabled={variaveis.length === 0}
            onChange={() => onChange({ tipo: "e", itens: [novaComparacao(variaveis)] })}
          />
          {rotuloQuando}
        </label>
      </div>
      {raiz && <BlocoDeGrupo grupo={raiz} variaveis={variaveis} onChange={onChange} profundidade={0} />}
    </div>
  );
}
