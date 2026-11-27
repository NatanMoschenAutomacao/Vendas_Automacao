"use client";
import { useRef, useState, useTransition, type PointerEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { Campo, Input, Select } from "@/ui/input";
import { Button } from "@/ui/button";
import { Mensagem } from "@/ui/card";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { ALVOS, ROTULO_ALVO, type HotspotEditado } from "./schema";

export interface OpcoesDeAlvo {
  equipamentos: { id: string; nome: string }[];
  modelos: { id: string; nome: string; equipamento: string }[];
  kits: { id: string; nome: string }[];
  /** Só quando a imagem pertence a um equipamento. */
  perguntas: { chave: string; texto: string; opcoes: { valor: string; rotulo: string }[] }[] | null;
}

const arred = (v: number) => Math.round(v * 10000) / 10000;
const limitar = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Editor de áreas clicáveis. Arraste sobre a imagem para desenhar uma área;
 * clique numa área para editá-la. Posições ficam em frações (0 a 1) da imagem.
 */
export function EditorDeHotspots({
  url,
  nome,
  largura,
  altura,
  inicial,
  alvos,
  salvar,
}: {
  url: string;
  nome: string;
  largura: number | null;
  altura: number | null;
  inicial: HotspotEditado[];
  alvos: OpcoesDeAlvo;
  salvar: (json: string) => Promise<EstadoDoFormulario>;
}) {
  const [areas, setAreas] = useState(inicial);
  const [sel, setSel] = useState<number | null>(inicial.length ? 0 : null);
  const [desenho, setDesenho] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null);
  const [estado, setEstado] = useState<EstadoDoFormulario>({});
  const [pendente, iniciar] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  const proporcao = largura && altura ? largura / altura : null;
  const tiposPermitidos = ALVOS.filter((a) => alvos.perguntas || (a !== "PERGUNTA" && a !== "OPCAO"));

  const ponto = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: limitar((e.clientX - r.left) / r.width), y: limitar((e.clientY - r.top) / r.height) };
  };

  function nova(x: number, y: number, largura: number, altura: number) {
    const area: HotspotEditado = {
      rotulo: `Área ${areas.length + 1}`,
      forma: "RETANGULO",
      x: arred(x),
      y: arred(y),
      largura: arred(largura),
      altura: arred(altura),
      alvoTipo: "EQUIPAMENTO",
      alvoId: "",
      alvoValor: null,
    };
    setAreas((l) => [...l, area]);
    setSel(areas.length);
  }

  const mudar = (m: Partial<HotspotEditado>) => sel !== null && setAreas((l) => l.map((a, i) => (i === sel ? { ...a, ...m } : a)));
  const atual = sel !== null ? areas[sel] : undefined;
  const pergunta = atual && alvos.perguntas?.find((p) => p.chave === atual.alvoId);

  return (
    <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-gray-500">Arraste sobre a imagem para desenhar uma área. Clique numa área para editá-la.</p>
        <div
          ref={ref}
          className="relative mx-auto w-full touch-none select-none overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
          style={proporcao ? { aspectRatio: String(proporcao), width: `min(100%, ${40 * proporcao}rem)` } : undefined}
          onPointerDown={(e) => {
            if (e.target !== e.currentTarget && !(e.target as HTMLElement).dataset.fundo) return;
            const p = ponto(e);
            e.currentTarget.setPointerCapture(e.pointerId);
            setDesenho({ x0: p.x, y0: p.y, x: p.x, y: p.y });
          }}
          onPointerMove={(e) => desenho && setDesenho({ ...desenho, ...ponto(e) })}
          onPointerUp={() => {
            if (!desenho) return;
            const x = Math.min(desenho.x0, desenho.x);
            const y = Math.min(desenho.y0, desenho.y);
            const w = Math.abs(desenho.x - desenho.x0);
            const h = Math.abs(desenho.y - desenho.y0);
            setDesenho(null);
            if (w >= 0.01 && h >= 0.01) nova(x, y, w, h);
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={nome} data-fundo="1" className={cn("block w-full", proporcao ? "h-full object-fill" : "h-auto")} draggable={false} />
          {areas.map((a, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Selecionar ${a.rotulo}`}
              onClick={() => setSel(i)}
              style={{ left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.largura * 100}%`, height: `${a.altura * 100}%` }}
              className={cn(
                "absolute border-2 text-xs font-medium text-white",
                a.forma === "ELIPSE" ? "rounded-full" : "rounded-md",
                i === sel ? "border-marca-600 bg-marca-600/30" : "border-white bg-grafite-900/20 hover:bg-marca-500/20",
              )}
            >
              <span className="absolute left-1 top-0.5 rounded bg-grafite-900/70 px-1">{i + 1}</span>
            </button>
          ))}
          {desenho && (
            <div
              className="pointer-events-none absolute border-2 border-dashed border-marca-600 bg-marca-500/20"
              style={{
                left: `${Math.min(desenho.x0, desenho.x) * 100}%`,
                top: `${Math.min(desenho.y0, desenho.y) * 100}%`,
                width: `${Math.abs(desenho.x - desenho.x0) * 100}%`,
                height: `${Math.abs(desenho.y - desenho.y0) * 100}%`,
              }}
            />
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Áreas">
          {areas.map((a, i) => (
            <button
              key={i}
              type="button"
              role="listitem"
              onClick={() => setSel(i)}
              className={cn("rounded-full border px-2.5 py-1 text-xs", i === sel ? "border-marca-600 bg-marca-50 text-marca-700" : "border-gray-200 hover:bg-gray-50")}
            >
              {i + 1}. {a.rotulo}
            </button>
          ))}
          <Button tamanho="sm" variante="secundario" type="button" onClick={() => nova(0.4, 0.4, 0.2, 0.2)}>
            <Plus className="size-4" /> Adicionar área
          </Button>
        </div>

        {atual ? (
          <div className="@container flex flex-col gap-3 rounded-lg border border-gray-200 p-4" role="group" aria-label="Área selecionada">
            <div className="grid gap-3 @md:grid-cols-[minmax(0,1fr)_9rem]">
              <Campo rotulo="Rótulo">
                <Input value={atual.rotulo} maxLength={120} onChange={(e) => mudar({ rotulo: e.target.value })} />
              </Campo>
              <Campo rotulo="Forma">
                <Select value={atual.forma} onChange={(e) => mudar({ forma: e.target.value as HotspotEditado["forma"] })}>
                  <option value="RETANGULO">Retângulo</option>
                  <option value="ELIPSE">Elipse</option>
                </Select>
              </Campo>
            </div>
            <Campo rotulo="Ao clicar">
              <Select value={atual.alvoTipo} onChange={(e) => mudar({ alvoTipo: e.target.value as HotspotEditado["alvoTipo"], alvoId: "", alvoValor: null })}>
                {tiposPermitidos.map((t) => (
                  <option key={t} value={t}>
                    {ROTULO_ALVO[t]}
                  </option>
                ))}
              </Select>
            </Campo>
            <Campo rotulo="Alvo">
              <Select value={atual.alvoId} onChange={(e) => mudar({ alvoId: e.target.value, alvoValor: null })}>
                <option value="">Escolha…</option>
                {atual.alvoTipo === "EQUIPAMENTO" &&
                  alvos.equipamentos.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                {atual.alvoTipo === "MODELO" &&
                  alvos.modelos.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.equipamento} › {x.nome}
                    </option>
                  ))}
                {atual.alvoTipo === "KIT" &&
                  alvos.kits.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.nome}
                    </option>
                  ))}
                {(atual.alvoTipo === "PERGUNTA" || atual.alvoTipo === "OPCAO") &&
                  (alvos.perguntas ?? [])
                    .filter((p) => atual.alvoTipo === "PERGUNTA" || p.opcoes.length > 0)
                    .map((p) => (
                      <option key={p.chave} value={p.chave}>
                        {p.texto}
                      </option>
                    ))}
              </Select>
            </Campo>
            {atual.alvoTipo === "OPCAO" && (
              <Campo rotulo="Opção">
                <Select value={atual.alvoValor ?? ""} onChange={(e) => mudar({ alvoValor: e.target.value || null })} disabled={!pergunta}>
                  <option value="">Escolha…</option>
                  {pergunta?.opcoes.map((o) => (
                    <option key={o.valor} value={o.valor}>
                      {o.rotulo}
                    </option>
                  ))}
                </Select>
              </Campo>
            )}
            <div className="grid grid-cols-2 gap-3 @md:grid-cols-4">
              {(["x", "y", "largura", "altura"] as const).map((k) => (
                <Campo key={k} rotulo={`${k === "x" ? "Esquerda" : k === "y" ? "Topo" : k === "largura" ? "Largura" : "Altura"} (%)`}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={Math.round(atual[k] * 1000) / 10}
                    onChange={(e) => mudar({ [k]: arred(limitar(Number(e.target.value) / 100)) })}
                  />
                </Campo>
              ))}
            </div>
            <div>
              <Button
                tamanho="sm"
                variante="perigo"
                type="button"
                onClick={() => {
                  setAreas((l) => l.filter((_, i) => i !== sel));
                  setSel(null);
                }}
              >
                <Trash2 className="size-4" /> Remover área
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Nenhuma área selecionada.</p>
        )}

        <div>
          <Button type="button" disabled={pendente} onClick={() => iniciar(async () => setEstado(await salvar(JSON.stringify(areas))))}>
            {pendente ? "Aguarde…" : "Salvar áreas"}
          </Button>
        </div>
        {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      </div>
    </div>
  );
}
