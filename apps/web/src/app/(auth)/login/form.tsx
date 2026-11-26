"use client";
import { useActionState } from "react";
import { entrar } from "@/features/auth/actions";
import { Card, Mensagem } from "@/ui/card";
import { Campo, Input } from "@/ui/input";
import { BotaoEnviar } from "@/ui/submit-button";
import { ESTADO_INICIAL } from "@/ui/form-status";

export function FormLogin() {
  const [estado, acao] = useActionState(entrar, ESTADO_INICIAL);
  return (
    <Card className="p-6">
      <h1 className="mb-6 text-lg font-semibold text-grafite-900">Entrar</h1>
      <form action={acao} className="flex flex-col gap-4">
        <Campo rotulo="Usuário">
          <Input name="usuario" autoComplete="username" autoCapitalize="none" required autoFocus />
        </Campo>
        <Campo rotulo="Senha">
          <Input name="senha" type="password" autoComplete="current-password" required />
        </Campo>
        {estado.mensagem && <Mensagem tipo="erro">{estado.mensagem}</Mensagem>}
        <BotaoEnviar>Entrar</BotaoEnviar>
      </form>
      <p className="mt-6 text-center text-xs text-gray-500">
        Esqueceu a senha? Peça ao administrador técnico para redefini-la.
      </p>
    </Card>
  );
}
