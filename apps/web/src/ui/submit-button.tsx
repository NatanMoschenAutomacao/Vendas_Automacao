"use client";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

export function BotaoEnviar({
  children,
  variante,
  tamanho,
}: {
  children: React.ReactNode;
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
  tamanho?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} variante={variante} tamanho={tamanho}>
      {pending ? "Aguarde…" : children}
    </Button>
  );
}
