"use client";
import { useActionState, useEffect, useRef } from "react";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { BotaoEnviar } from "@/ui/submit-button";
import { ESTADO_INICIAL, type EstadoDoFormulario } from "@/ui/form-status";

export function FormCategoria({
  acao,
  opcoesPai,
  valores,
  rotuloBotao,
}: {
  acao: (estado: EstadoDoFormulario, form: FormData) => Promise<EstadoDoFormulario>;
  opcoesPai: { id: string; rotulo: string }[];
  valores?: { nome: string; descricao: string | null; paiId: string | null };
  rotuloBotao: string;
}) {
  const [estado, enviar] = useActionState(acao, ESTADO_INICIAL);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok && !valores) ref.current?.reset();
  }, [estado, valores]);

  return (
    <form ref={ref} action={enviar} className="flex flex-col gap-4">
      <Campo rotulo="Nome" erro={estado.erros?.nome}>
        <Input name="nome" defaultValue={valores?.nome} required maxLength={80} />
      </Campo>
      <Campo rotulo="Dentro de" erro={estado.erros?.paiId} ajuda="Deixe em branco para uma categoria principal.">
        <Select name="paiId" defaultValue={valores?.paiId ?? ""}>
          <option value="">(categoria principal)</option>
          {opcoesPai.map((o) => (
            <option key={o.id} value={o.id}>
              {o.rotulo}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo rotulo="Descrição" erro={estado.erros?.descricao}>
        <Textarea name="descricao" defaultValue={valores?.descricao ?? ""} maxLength={300} />
      </Campo>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar>{rotuloBotao}</BotaoEnviar>
      </div>
    </form>
  );
}
