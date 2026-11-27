"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/ui/button";
import { Campo, Input, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CaixaDeSelecao } from "@/features/equipamentos/formularios";
import { alternarAtivoCadastro, excluirCadastro, moverCadastro } from "./actions";
import { INFO_DO_CADASTRO, type Cadastro } from "./schema";

export function FormCadastro({
  cadastro,
  acao,
  inicial,
}: {
  cadastro: Cadastro;
  acao: (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;
  inicial?: { codigo?: string; nome: string; descricao: string | null; isDemo: boolean; fisico?: boolean };
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok && !inicial) ref.current?.reset();
  }, [estado, inicial]);
  const e = estado.erros ?? {};
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-col gap-4">
      {cadastro === "tipo-de-recurso" && (
        <Campo rotulo="Código" erro={e.codigo} ajuda="Ex.: DI, DO, AI, AO, SP, RS485.">
          <Input name="codigo" defaultValue={inicial?.codigo} required maxLength={20} className="uppercase" />
        </Campo>
      )}
      {cadastro === "funcao-de-controle" && (
        <Campo rotulo="Código" erro={e.codigo} ajuda="Ex.: temperatura. Usado em regras e relatórios.">
          <Input name="codigo" defaultValue={inicial?.codigo} required maxLength={40} />
        </Campo>
      )}
      <Campo rotulo="Nome" erro={e.nome}>
        <Input name="nome" defaultValue={inicial?.nome} required maxLength={80} />
      </Campo>
      <Campo rotulo="Descrição" erro={e.descricao}>
        <Textarea name="descricao" defaultValue={inicial?.descricao ?? ""} maxLength={500} />
      </Campo>
      {cadastro === "tipo-de-recurso" && (
        <CaixaDeSelecao name="fisico" rotulo="Ponto físico de I/O" ajuda="Desmarque para saídas funcionais e comunicação." defaultChecked={inicial?.fisico ?? true} />
      )}
      <CaixaDeSelecao name="isDemo" rotulo="Dado de demonstração (DEMO)" defaultChecked={inicial?.isDemo} />
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>{inicial ? "Salvar" : INFO_DO_CADASTRO[cadastro].novo.replace(/^Nov[oa] /, "Criar ")}</BotaoEnviar>
      </div>
    </form>
  );
}

export function AcoesDoCadastro({
  cadastro,
  id,
  nome,
  ativo,
  primeira,
  ultima,
}: {
  cadastro: Cadastro;
  id: string;
  nome: string;
  ativo: boolean;
  primeira: boolean;
  ultima: boolean;
}) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      primeira={primeira}
      ultima={ultima}
      hrefEditar={`${INFO_DO_CADASTRO[cadastro].caminho}?editar=${id}`}
      subir={() => moverCadastro(cadastro, id, "cima")}
      descer={() => moverCadastro(cadastro, id, "baixo")}
      alternarAtivo={() => alternarAtivoCadastro(cadastro, id)}
      excluir={() => excluirCadastro(cadastro, id)}
      avisoExclusao="Orçamentos que usam este cadastro passam a mostrar uma pendência."
    />
  );
}

export function BotaoTiposPadrao({ acao }: { acao: () => Promise<EstadoDoFormulario> }) {
  const [estado, setEstado] = useState<EstadoDoFormulario>({});
  const [pendente, iniciar] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variante="secundario" disabled={pendente} onClick={() => iniciar(async () => setEstado(await acao()))}>
        Adicionar DI, DO, AI e AO
      </Button>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
    </div>
  );
}
