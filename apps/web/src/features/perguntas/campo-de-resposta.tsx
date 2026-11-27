"use client";
import type { OpcaoDeResposta, Pergunta, ValorDeResposta } from "@zanatta/engine";
import { cn } from "@/lib/cn";
import { Input, Select, Textarea } from "@/ui/input";

/**
 * Campo de resposta de uma pergunta, usado na pré-visualização e no
 * configurador do vendedor. Um tipo novo de pergunta só precisa de um caso aqui.
 */
export function CampoDeResposta({
  pergunta: p,
  opcoes,
  valor,
  onChange,
  erro,
  valorAutomatico,
}: {
  pergunta: Pergunta;
  opcoes: OpcaoDeResposta[];
  valor: ValorDeResposta | null | undefined;
  onChange: (v: ValorDeResposta | null) => void;
  erro?: string;
  /** Valor de INFORMACAO e CALCULADO, que o vendedor não digita. */
  valorAutomatico?: ValorDeResposta;
}) {
  const id = `resp-${p.chave}`;
  const rotulo = (
    <span className="text-sm font-medium text-grafite-700">
      {p.texto}
      {p.obrigatoria && <span className="text-red-600"> *</span>}
      {p.unidade && <span className="font-normal text-gray-500"> ({p.unidade})</span>}
    </span>
  );
  const ajuda = p.ajuda && <span className="text-xs text-gray-500">{p.ajuda}</span>;
  const rodape = erro && <span className="text-xs text-red-600">{erro}</span>;

  if (p.tipo === "INFORMACAO" || p.tipo === "CALCULADO") {
    const v = valorAutomatico;
    const texto = v === undefined ? "—" : typeof v === "boolean" ? (v ? "Sim" : "Não") : Array.isArray(v) ? v.join(", ") : typeof v === "number" ? v.toLocaleString("pt-BR") : v;
    return (
      <div className="flex flex-col gap-1">
        {rotulo}
        <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-grafite-800">
          {texto}
          {p.unidade && v !== undefined ? ` ${p.unidade}` : ""}
          <span className="ml-2 text-xs text-gray-400">{p.tipo === "INFORMACAO" ? "do modelo" : "calculado"}</span>
        </div>
        {ajuda}
        {rodape}
      </div>
    );
  }

  if (p.tipo === "SELECAO_UNICA" || p.tipo === "SELECAO_IMAGEM" || p.tipo === "SELECAO_MULTIPLA") {
    const multipla = p.tipo === "SELECAO_MULTIPLA";
    const marcados = multipla ? (Array.isArray(valor) ? valor : []) : [valor];
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5">{rotulo}</legend>
        <div className={cn("flex flex-wrap gap-2", p.tipo === "SELECAO_IMAGEM" && "grid grid-cols-2 sm:grid-cols-3")}>
          {opcoes.map((o) => {
            const ativo = marcados.includes(o.valor);
            return (
              <label
                key={o.valor}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
                  ativo ? "border-marca-600 bg-marca-50 text-marca-700" : "border-gray-200 hover:bg-gray-50",
                  p.tipo === "SELECAO_IMAGEM" && "flex-col",
                )}
              >
                <input
                  type={multipla ? "checkbox" : "radio"}
                  name={id}
                  value={o.valor}
                  checked={ativo}
                  className="sr-only"
                  onChange={(e) => {
                    if (!multipla) return onChange(o.valor);
                    const atual = Array.isArray(valor) ? valor : [];
                    const novo = e.target.checked ? [...atual, o.valor] : atual.filter((x) => x !== o.valor);
                    onChange(opcoes.map((x) => x.valor).filter((x) => novo.includes(x)));
                  }}
                />
                {p.tipo === "SELECAO_IMAGEM" && o.imagemUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.imagemUrl} alt="" className="h-16 w-full rounded object-contain" />
                )}
                {o.rotulo}
              </label>
            );
          })}
          {opcoes.length === 0 && <span className="text-sm text-gray-500">Nenhuma opção disponível.</span>}
        </div>
        {ajuda}
        {rodape}
      </fieldset>
    );
  }

  let controle: React.ReactNode;
  if (p.tipo === "LISTA") {
    controle = (
      <Select id={id} value={typeof valor === "string" ? valor : ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Escolha…</option>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </Select>
    );
  } else if (p.tipo === "SIM_NAO") {
    controle = (
      <Select
        id={id}
        value={valor === true ? "sim" : valor === false ? "nao" : ""}
        onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "sim")}
      >
        <option value="">Escolha…</option>
        <option value="sim">Sim</option>
        <option value="nao">Não</option>
      </Select>
    );
  } else if (p.tipo === "TEXTO_LONGO") {
    controle = <Textarea id={id} value={typeof valor === "string" ? valor : ""} maxLength={4000} onChange={(e) => onChange(e.target.value || null)} />;
  } else if (p.tipo === "TEXTO_CURTO") {
    controle = <Input id={id} value={typeof valor === "string" ? valor : ""} maxLength={200} onChange={(e) => onChange(e.target.value || null)} />;
  } else {
    controle = (
      <Input
        id={id}
        type="number"
        inputMode={p.tipo === "DECIMAL" ? "decimal" : "numeric"}
        min={p.minimo ?? undefined}
        max={p.maximo ?? undefined}
        step={p.passo ?? (p.tipo === "DECIMAL" ? "any" : 1)}
        value={typeof valor === "number" ? valor : ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
      />
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id}>{rotulo}</label>
      {controle}
      {ajuda}
      {rodape}
    </div>
  );
}
