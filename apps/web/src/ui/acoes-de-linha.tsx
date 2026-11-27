"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Acao = () => Promise<unknown>;

export function BotaoIcone({
  titulo,
  onClick,
  children,
  perigo,
  disabled,
}: {
  titulo: string;
  onClick?: () => void;
  children: React.ReactNode;
  perigo?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={titulo}
      aria-label={titulo}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "grid size-8 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 disabled:opacity-30",
        perigo ? "hover:text-red-600" : "hover:text-grafite-800",
      )}
    >
      {children}
    </button>
  );
}

/**
 * Ações de uma linha de cadastro (subir, descer, editar, duplicar,
 * ativar/inativar, excluir). Cada ação é uma Server Action já vinculada ao id.
 */
export function AcoesDeLinha({
  nome,
  ativo,
  primeira,
  ultima,
  hrefEditar,
  subir,
  descer,
  duplicar,
  alternarAtivo,
  excluir,
  avisoExclusao,
}: {
  nome: string;
  ativo?: boolean;
  primeira?: boolean;
  ultima?: boolean;
  hrefEditar?: string;
  subir?: Acao;
  descer?: Acao;
  duplicar?: Acao;
  alternarAtivo?: Acao;
  excluir?: () => Promise<{ ok?: boolean; mensagem?: string } | void>;
  avisoExclusao?: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string>();
  const rodar = (a?: Acao) => a && iniciar(async () => void (await a()));

  if (confirmar && excluir) {
    return (
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
        <span className="text-gray-600">
          Excluir &quot;{nome}&quot;?{avisoExclusao && <span className="block text-xs text-gray-500">{avisoExclusao}</span>}
        </span>
        <button
          type="button"
          className="rounded-md px-2 py-1 font-medium text-red-700 hover:bg-red-50"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await excluir();
              if (r && !r.ok && r.mensagem) setErro(r.mensagem);
              setConfirmar(false);
            })
          }
        >
          Confirmar exclusão
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100"
          onClick={() => setConfirmar(false)}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center">
      {erro && <span className="mr-2 max-w-xs text-xs text-red-600">{erro}</span>}
      {subir && (
        <BotaoIcone titulo="Subir" disabled={primeira || pendente} onClick={() => rodar(subir)}>
          <ArrowUp className="size-4" />
        </BotaoIcone>
      )}
      {descer && (
        <BotaoIcone titulo="Descer" disabled={ultima || pendente} onClick={() => rodar(descer)}>
          <ArrowDown className="size-4" />
        </BotaoIcone>
      )}
      {hrefEditar && (
        <Link
          href={hrefEditar}
          title="Editar"
          aria-label="Editar"
          className="grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-grafite-800"
        >
          <Pencil className="size-4" />
        </Link>
      )}
      {duplicar && (
        <BotaoIcone titulo="Duplicar" disabled={pendente} onClick={() => rodar(duplicar)}>
          <Copy className="size-4" />
        </BotaoIcone>
      )}
      {alternarAtivo && (
        <BotaoIcone titulo={ativo ? "Inativar" : "Ativar"} disabled={pendente} onClick={() => rodar(alternarAtivo)}>
          {ativo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </BotaoIcone>
      )}
      {excluir && (
        <BotaoIcone
          titulo="Excluir"
          perigo
          disabled={pendente}
          onClick={() => {
            setErro(undefined);
            setConfirmar(true);
          }}
        >
          <Trash2 className="size-4" />
        </BotaoIcone>
      )}
    </div>
  );
}
