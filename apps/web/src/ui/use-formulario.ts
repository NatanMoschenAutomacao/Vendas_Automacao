"use client";
import { startTransition, useActionState, type FormEvent } from "react";
import { ESTADO_INICIAL, type EstadoDoFormulario } from "./form-status";

/**
 * Envia o formulário para uma Server Action sem o reset automático do React 19,
 * para que o usuário não perca o que digitou quando a validação recusa.
 */
export function useFormulario(acao: (estado: EstadoDoFormulario, form: FormData) => Promise<EstadoDoFormulario>) {
  const [estado, despachar, pendente] = useActionState(acao, ESTADO_INICIAL);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const dados = new FormData(e.currentTarget);
    startTransition(() => despachar(dados));
  };
  return { estado, onSubmit, pendente };
}
