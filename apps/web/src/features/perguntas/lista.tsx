import Link from "next/link";
import { Plus } from "lucide-react";
import { descreverCondicao, ROTULO_TIPO_PERGUNTA, type TipoDePergunta, type Condicao } from "@zanatta/engine";
import { Badge, Card } from "@/ui/card";
import { AcoesDaPergunta } from "./acoes";

export interface LinhaDaLista {
  id: string;
  chave: string;
  texto: string;
  tipo: string;
  modo?: string;
  obrigatoria: boolean;
  ativo: boolean;
  condicao: unknown;
}

const ROTULO_MODO: Record<string, string> = { SUBSTITUIR: "Substitui", OCULTAR: "Oculta" };

export function ListaDePerguntas({
  perguntas,
  rotulos,
  hrefBase,
  hrefNova,
  vazio,
}: {
  perguntas: LinhaDaLista[];
  rotulos: Record<string, string>;
  hrefBase: string;
  hrefNova: string;
  vazio: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Card className="overflow-hidden" role="region" aria-label="Perguntas">
        {perguntas.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">{vazio}</p>
        ) : (
          perguntas.map((p, i) => (
            <div key={p.id} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 hover:bg-gray-50/60">
              <Link href={`${hrefBase}/${p.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={p.ativo ? "font-medium text-grafite-800" : "text-gray-400 line-through"}>{p.texto}</span>
                  {p.modo && ROTULO_MODO[p.modo] && <Badge tom="marca">{ROTULO_MODO[p.modo]}</Badge>}
                  {p.obrigatoria && <Badge tom="aviso">Obrigatória</Badge>}
                  {!p.ativo && <Badge>Inativa</Badge>}
                </div>
                <p className="truncate text-xs text-gray-500">
                  <span className="font-mono">{p.chave}</span> · {ROTULO_TIPO_PERGUNTA[p.tipo as TipoDePergunta] ?? p.tipo} · Exibir:{" "}
                  {descreverCondicao(p.condicao as Condicao | null, rotulos)}
                </p>
              </Link>
              <AcoesDaPergunta
                id={p.id}
                nome={p.texto}
                ativo={p.ativo}
                primeira={i === 0}
                ultima={i === perguntas.length - 1}
                hrefEditar={`${hrefBase}/${p.id}`}
              />
            </div>
          ))
        )}
      </Card>
      <div>
        <Link
          href={hrefNova}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-marca-600 px-3 text-sm font-medium text-white hover:bg-marca-700"
        >
          <Plus className="size-4" /> Nova pergunta
        </Link>
      </div>
    </div>
  );
}
