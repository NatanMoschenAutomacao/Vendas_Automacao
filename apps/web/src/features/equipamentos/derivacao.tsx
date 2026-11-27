"use client";
import { useState } from "react";
import { Campo, Input, Select } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";

type Tipo = "NENHUM" | "INDIVIDUAL" | "COLETIVO";
export interface ValoresDeDerivacao {
  acionamento: Tipo | null;
  acionamentoPorGrupo: number | null;
  protecao: Tipo | null;
  protecaoPorGrupo: number | null;
}

const ROTULO: Record<Tipo, string> = {
  NENHUM: "Não gera",
  INDIVIDUAL: "Individual (um por unidade)",
  COLETIVO: "Coletivo (um para cada N unidades)",
};

function Linha({ nome, rotulo, tipo, porGrupo, erro, herdavel }: { nome: "acionamento" | "protecao"; rotulo: string; tipo: Tipo | null; porGrupo: number | null; erro?: string; herdavel: boolean }) {
  const [atual, setAtual] = useState<string>(tipo ?? (herdavel ? "" : "NENHUM"));
  return (
    <div className="grid gap-3 @lg:grid-cols-[minmax(0,1fr)_10rem]">
      <Campo rotulo={rotulo}>
        <Select name={nome} value={atual} onChange={(e) => setAtual(e.target.value)}>
          {herdavel && <option value="">Igual ao equipamento</option>}
          {(Object.keys(ROTULO) as Tipo[]).map((t) => (
            <option key={t} value={t}>
              {ROTULO[t]}
            </option>
          ))}
        </Select>
      </Campo>
      {atual === "COLETIVO" && (
        <Campo rotulo={`Unidades por ${nome === "acionamento" ? "acionamento" : "proteção"}`} erro={erro}>
          <Input name={`${nome}PorGrupo`} type="number" min={1} step={1} defaultValue={porGrupo ?? ""} required />
        </Campo>
      )}
    </div>
  );
}

/**
 * Regras de acionamento e proteção (§18): derivadas das unidades do
 * modelo, nunca da contagem de equipamentos ou de grupos.
 */
export function FormDerivacao({
  acao,
  valores,
  herdavel,
}: {
  acao: (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;
  valores: ValoresDeDerivacao;
  /** No modelo, permite "igual ao equipamento". */
  herdavel?: boolean;
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="@container flex flex-col gap-4" aria-label="Acionamento e proteção">
      <Linha nome="acionamento" rotulo="Acionamento" tipo={valores.acionamento} porGrupo={valores.acionamentoPorGrupo} erro={e.acionamentoPorGrupo} herdavel={!!herdavel} />
      <Linha nome="protecao" rotulo="Proteção" tipo={valores.protecao} porGrupo={valores.protecaoPorGrupo} erro={e.protecaoPorGrupo} herdavel={!!herdavel} />
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Salvar regras</BotaoEnviar>
      </div>
    </form>
  );
}
