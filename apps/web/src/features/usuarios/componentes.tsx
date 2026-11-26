"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Campo, Input, Select } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { BotaoEnviar } from "@/ui/submit-button";
import { ESTADO_INICIAL } from "@/ui/form-status";
import { alterarPerfil, alternarAtivoUsuario, criarUsuario, redefinirSenha } from "./actions";

export function FormNovoUsuario() {
  const [estado, enviar] = useActionState(criarUsuario, ESTADO_INICIAL);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);
  return (
    <form ref={ref} action={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Usuário (login)" erro={estado.erros?.usuario}>
        <Input name="usuario" autoCapitalize="none" required />
      </Campo>
      <Campo rotulo="Nome" erro={estado.erros?.nome}>
        <Input name="nome" required />
      </Campo>
      <Campo rotulo="Perfil" erro={estado.erros?.perfil}>
        <Select name="perfil" defaultValue="VENDEDOR">
          <option value="VENDEDOR">Vendedor</option>
          <option value="ADMIN_TECNICO">Administrador técnico</option>
        </Select>
      </Campo>
      <Campo rotulo="Senha temporária" erro={estado.erros?.senha} ajuda="O usuário troca no primeiro acesso.">
        <Input name="senha" type="text" autoComplete="off" required />
      </Campo>
      {estado.mensagem && <Mensagem tipo="sucesso">{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar>Criar usuário</BotaoEnviar>
      </div>
    </form>
  );
}

export function AcoesUsuario({
  id,
  perfil,
  ativo,
  eu,
}: {
  id: string;
  perfil: string;
  ativo: boolean;
  eu: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string>();
  const [redefinindo, setRedefinindo] = useState(false);
  const [estadoSenha, enviarSenha] = useActionState(redefinirSenha.bind(null, id), ESTADO_INICIAL);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <Select
          aria-label="Perfil"
          className="h-8 w-48"
          defaultValue={perfil}
          disabled={pendente}
          onChange={(e) =>
            iniciar(async () => {
              const r = await alterarPerfil(id, e.target.value);
              setErro(r.ok ? undefined : r.mensagem);
            })
          }
        >
          <option value="VENDEDOR">Vendedor</option>
          <option value="ADMIN_TECNICO">Administrador técnico</option>
        </Select>
        <Button tamanho="sm" variante="secundario" onClick={() => setRedefinindo((v) => !v)}>
          Redefinir senha
        </Button>
        {!eu && (
          <Button
            tamanho="sm"
            variante={ativo ? "perigo" : "secundario"}
            disabled={pendente}
            onClick={() =>
              iniciar(async () => {
                const r = await alternarAtivoUsuario(id);
                setErro(r.ok ? undefined : r.mensagem);
              })
            }
          >
            {ativo ? "Desativar" : "Reativar"}
          </Button>
        )}
      </div>
      {redefinindo && (
        <form action={enviarSenha} className="flex items-center gap-2">
          <Input name="senha" placeholder="Nova senha temporária" className="h-8 w-56" autoComplete="off" required />
          <BotaoEnviar tamanho="sm">Salvar</BotaoEnviar>
        </form>
      )}
      {estadoSenha.mensagem && (
        <span className={estadoSenha.ok ? "text-xs text-marca-700" : "text-xs text-red-600"}>{estadoSenha.mensagem}</span>
      )}
      {erro && <span className="text-xs text-red-600">{erro}</span>}
    </div>
  );
}
