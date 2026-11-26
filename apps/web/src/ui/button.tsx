import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variante = "primario" | "secundario" | "fantasma" | "perigo";

const estilos: Record<Variante, string> = {
  primario: "bg-marca-600 text-white hover:bg-marca-700 disabled:bg-marca-600/50",
  secundario: "bg-white text-grafite-800 border border-gray-200 hover:bg-gray-50",
  fantasma: "text-grafite-700 hover:bg-gray-100",
  perigo: "bg-white text-red-700 border border-red-200 hover:bg-red-50",
};

export function Button({
  variante = "primario",
  tamanho = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: "sm" | "md" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed",
        tamanho === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm",
        estilos[variante],
        className,
      )}
      {...props}
    />
  );
}
