import Link from "next/link";
import { Badge } from "@/ui/card";
import { ROTULO_BASE } from "./schema";
import { AcoesDaRegra } from "./acoes";
import type { BaseDeCalculo } from "@zanatta/engine";

export interface RegraNaLista {
  id: string;
  codigo: string;
  nome: string;
  estagio: "RECURSO" | "MATERIAL";
  base: string;
  prioridade: number;
  ativo: boolean;
  isDemo: boolean;
  efeitos: unknown;
  condicao: unknown;
}

/** Lista compacta de regras (página de regras e aba do equipamento). */
export function ListaDeRegras({ regras, vazio, rotulo }: { regras: RegraNaLista[]; vazio: string; rotulo: string }) {
  if (regras.length === 0) return <p className="px-4 py-3 text-sm text-gray-500">{vazio}</p>;
  return (
    <ul className="divide-y divide-gray-100" aria-label={rotulo}>
      {regras.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <Link href={`/admin/regras/${r.id}`} className="font-medium text-grafite-900 hover:text-marca-700">
              {r.nome}
            </Link>
            <p className="text-xs text-gray-500">
              <span className="font-mono">{r.codigo}</span> · {ROTULO_BASE[r.base as BaseDeCalculo] ?? r.base} · {Array.isArray(r.efeitos) ? r.efeitos.length : 0} efeito(s) ·
              prioridade {r.prioridade}
              {r.condicao ? " · com condição" : ""}
            </p>
          </div>
          <Badge tom={r.estagio === "RECURSO" ? "marca" : "neutro"}>{r.estagio === "RECURSO" ? "Recurso" : "Material"}</Badge>
          {!r.ativo && <Badge>Inativa</Badge>}
          {r.isDemo && <Badge tom="demo">DEMO</Badge>}
          <AcoesDaRegra id={r.id} nome={r.nome} ativo={r.ativo} />
        </li>
      ))}
    </ul>
  );
}
