"use client";
import { useFormStatus } from "react-dom";
import { Button } from "./button";

export function BotaoEnviar({
  children,
  variante,
  tamanho,
  pendente,
}: {
  children: React.ReactNode;
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
  tamanho?: "sm" | "md";
  /** Use quando o formulário é enviado por onSubmit (useFormulario). */
  pendente?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendente ?? status.pending;
  return (
    <Button type="submit" disabled={pending} variante={variante} tamanho={tamanho}>
      {pending ? "Aguarde…" : children}
    </Button>
  );
}
