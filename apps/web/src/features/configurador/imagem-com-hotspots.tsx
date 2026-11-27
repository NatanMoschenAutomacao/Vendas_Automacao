"use client";
import { cn } from "@/lib/cn";
import type { HotspotDoConfigurador, ImagemInterativaDoConfigurador } from "./tipos";

/**
 * Imagem interativa do vendedor: cada hotspot é um botão posicionado em
 * porcentagem sobre a imagem, então acompanha qualquer tamanho de tela.
 */
export function ImagemComHotspots({
  imagem,
  aoClicar,
  ativo,
  selo,
  alturaMaxima = 32,
}: {
  imagem: ImagemInterativaDoConfigurador;
  aoClicar: (h: HotspotDoConfigurador) => void;
  /** Hotspot marcado (ex.: opção escolhida, equipamento já no projeto). */
  ativo?: (h: HotspotDoConfigurador) => boolean;
  /** Texto pequeno sobre o hotspot (ex.: quantidade no projeto). */
  selo?: (h: HotspotDoConfigurador) => string | null;
  /** Altura máxima em rem; a largura acompanha a proporção da imagem. */
  alturaMaxima?: number;
}) {
  const proporcao = imagem.largura && imagem.altura ? imagem.largura / imagem.altura : null;
  return (
    <figure className="flex flex-col gap-2">
      <div
        className="relative mx-auto w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
        style={proporcao ? { aspectRatio: String(proporcao), width: `min(100%, ${alturaMaxima * proporcao}rem)` } : undefined}
        role="group"
        aria-label={imagem.nome}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imagem.url}
          alt={imagem.textoAlternativo ?? imagem.nome}
          width={imagem.largura ?? undefined}
          height={imagem.altura ?? undefined}
          className={cn("block w-full select-none", proporcao ? "h-full object-fill" : "h-auto")}
          draggable={false}
        />
        {imagem.hotspots.map((h) => {
          const marcado = ativo?.(h) ?? false;
          const texto = selo?.(h);
          return (
            <button
              key={h.id}
              type="button"
              aria-label={h.rotulo}
              aria-pressed={ativo ? marcado : undefined}
              title={h.rotulo}
              onClick={() => aoClicar(h)}
              style={{
                left: `${h.x * 100}%`,
                top: `${h.y * 100}%`,
                width: `${h.largura * 100}%`,
                height: `${h.altura * 100}%`,
              }}
              className={cn(
                "group absolute border-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-marca-200",
                h.forma === "ELIPSE" ? "rounded-full" : "rounded-md",
                marcado
                  ? "border-marca-600 bg-marca-600/25"
                  : "border-white/80 bg-white/10 hover:border-marca-500 hover:bg-marca-500/20",
              )}
            >
              <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-grafite-900 px-2 py-0.5 text-xs text-white group-hover:block group-focus-visible:block">
                {h.rotulo}
              </span>
              {texto && (
                <span className="absolute -right-2 -top-2 grid min-w-5 place-items-center rounded-full bg-marca-600 px-1 text-xs font-medium text-white">
                  {texto}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <figcaption className="text-xs text-gray-500">
        {imagem.nome}
        {imagem.isDemo && <span className="ml-2 rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">DEMO</span>}
      </figcaption>
    </figure>
  );
}
