import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-card border border-gray-200 bg-white shadow-sm shadow-gray-100", className)}
      {...props}
    />
  );
}

export function Badge({
  tom = "neutro",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tom?: "neutro" | "marca" | "aviso" | "demo" }) {
  const tons = {
    neutro: "bg-gray-100 text-gray-600",
    marca: "bg-marca-50 text-marca-700",
    aviso: "bg-amber-50 text-amber-700",
    demo: "bg-violet-50 text-violet-700",
  };
  return (
    <span
      className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium", tons[tom], className)}
      {...props}
    />
  );
}

export function CabecalhoDePagina({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-grafite-900">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-gray-500">{descricao}</p>}
      </div>
      {acoes}
    </div>
  );
}

export function Mensagem({ tipo, children }: { tipo: "erro" | "sucesso"; children: React.ReactNode }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        tipo === "erro" ? "bg-red-50 text-red-700" : "bg-marca-50 text-marca-700",
      )}
    >
      {children}
    </p>
  );
}
