"use client";
import { useActionState } from "react";
import { trocarSenha } from "@/features/auth/actions";
import { Card } from "@/ui/card";
import { Campo, Input } from "@/ui/input";
import { BotaoEnviar } from "@/ui/submit-button";
import { ESTADO_INICIAL } from "@/ui/form-status";

export function FormTrocaSenha({ obrigatoria, nome }: { obrigatoria: boolean; nome: string }) {
  const [estado, acao] = useActionState(trocarSenha, ESTADO_INICIAL);
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold text-grafite-900">Trocar senha</h1>
      <p className="mb-6 mt-1 text-sm text-gray-500">
        {obrigatoria ? `Olá, ${nome}. Defina uma senha pessoal para continuar.` : "Defina sua nova senha."}
      </p>
      <form action={acao} className="flex flex-col gap-4">
        <Campo rotulo="Senha atual" erro={estado.erros?.atual}>
          <Input name="atual" type="password" autoComplete="current-password" required />
        </Campo>
        <Campo rotulo="Nova senha" erro={estado.erros?.nova} ajuda="Mínimo de 8 caracteres, com letras e números.">
          <Input name="nova" type="password" autoComplete="new-password" required />
        </Campo>
        <Campo rotulo="Confirmar nova senha" erro={estado.erros?.confirmacao}>
          <Input name="confirmacao" type="password" autoComplete="new-password" required />
        </Campo>
        <BotaoEnviar>Salvar senha</BotaoEnviar>
      </form>
    </Card>
  );
}
