"use client";
import { useState } from "react";
import { editarTrechoDoDescritivo, type ConfiguracaoDoProjeto, type ParagrafoDoDescritivo, type SecaoGerada } from "@zanatta/engine";
import { Badge, Card } from "@/ui/card";
import { Button } from "@/ui/button";
import { Textarea } from "@/ui/input";

type Mudar = (f: (c: ConfiguracaoDoProjeto) => ConfiguracaoDoProjeto) => void;

function Trecho({ p, mudar, editavel }: { p: ParagrafoDoDescritivo; mudar: Mudar; editavel: boolean }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.texto);
  return (
    <li className="py-3" data-trecho={p.chave} data-editado={p.editado ? "sim" : undefined}>
      {editando ? (
        <div className="flex flex-col gap-2">
          <Textarea aria-label="Texto do trecho" rows={4} value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} />
          <div className="flex gap-2">
            <Button
              type="button"
              tamanho="sm"
              disabled={!texto.trim()}
              onClick={() => {
                mudar((c) => editarTrechoDoDescritivo(c, p.chave, texto.trim(), p.gerado));
                setEditando(false);
              }}
            >
              Salvar trecho
            </Button>
            <Button type="button" tamanho="sm" variante="fantasma" onClick={() => setEditando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3">
          <p className="min-w-0 flex-1 whitespace-pre-line text-sm text-grafite-800">{p.texto}</p>
          {p.editado && <Badge tom={p.desatualizado ? "aviso" : "marca"}>{p.desatualizado ? "Editado, pode estar desatualizado" : "Editado"}</Badge>}
          {editavel && (
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                tamanho="sm"
                variante="secundario"
                onClick={() => {
                  setTexto(p.texto);
                  setEditando(true);
                }}
              >
                Editar trecho
              </Button>
              {p.editado && (
                <Button type="button" tamanho="sm" variante="fantasma" onClick={() => mudar((c) => editarTrechoDoDescritivo(c, p.chave, null, ""))}>
                  Restaurar texto gerado
                </Button>
              )}
            </div>
          )}
        </div>
      )}
      {p.desatualizado && !editando && <p className="mt-1 text-xs text-amber-700">Texto gerado agora: {p.gerado}</p>}
    </li>
  );
}

/** Aba "Descritivo": texto técnico montado pelos modelos de texto, com edição por trecho (Fase 10). */
export function PainelDoDescritivo({ descritivo, mudar, editavel }: { descritivo: SecaoGerada[]; mudar: Mudar; editavel: boolean }) {
  if (descritivo.length === 0)
    return (
      <Card className="p-5 text-sm text-gray-500" role="region" aria-label="Descritivo técnico">
        Nenhum trecho de descritivo se aplica a este projeto. Os textos são cadastrados pela equipe técnica em Modelos de texto.
      </Card>
    );
  return (
    <Card className="p-5" role="region" aria-label="Descritivo técnico">
      {descritivo.map((s, n) => (
        <section key={s.id} aria-label={s.titulo} className="mb-4 last:mb-0">
          <h2 className="font-medium text-grafite-900">
            {n + 1}. {s.titulo}
          </h2>
          <ul className="divide-y divide-gray-100">
            {s.paragrafos.map((p) => (
              <Trecho key={p.chave + p.texto} p={p} mudar={mudar} editavel={editavel} />
            ))}
          </ul>
        </section>
      ))}
    </Card>
  );
}
