"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  alternarAtivoCategoria,
  duplicarCategoria,
  excluirCategoria,
  moverCategoria,
} from "./actions";

function Icone({
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

export function AcoesDaLinha({
  id,
  nome,
  ativo,
  primeira,
  ultima,
}: {
  id: string;
  nome: string;
  ativo: boolean;
  primeira: boolean;
  ultima: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const [erro, setErro] = useState<string>();

  if (confirmar) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">Excluir &quot;{nome}&quot;?</span>
        <button
          type="button"
          className="rounded-md px-2 py-1 font-medium text-red-700 hover:bg-red-50"
          disabled={pendente}
          onClick={() =>
            iniciar(async () => {
              const r = await excluirCategoria(id);
              if (!r.ok) setErro(r.mensagem);
              setConfirmar(false);
            })
          }
        >
          Excluir
        </button>
        <button type="button" className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100" onClick={() => setConfirmar(false)}>
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      {erro && <span className="mr-2 max-w-xs text-xs text-red-600">{erro}</span>}
      <Icone titulo="Subir" disabled={primeira || pendente} onClick={() => iniciar(() => moverCategoria(id, "cima"))}>
        <ArrowUp className="size-4" />
      </Icone>
      <Icone titulo="Descer" disabled={ultima || pendente} onClick={() => iniciar(() => moverCategoria(id, "baixo"))}>
        <ArrowDown className="size-4" />
      </Icone>
      <Link
        href={`/admin/categorias/${id}`}
        title="Editar"
        aria-label="Editar"
        className="grid size-8 place-items-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-grafite-800"
      >
        <Pencil className="size-4" />
      </Link>
      <Icone titulo="Duplicar" disabled={pendente} onClick={() => iniciar(() => duplicarCategoria(id))}>
        <Copy className="size-4" />
      </Icone>
      <Icone
        titulo={ativo ? "Inativar" : "Ativar"}
        disabled={pendente}
        onClick={() => iniciar(() => alternarAtivoCategoria(id))}
      >
        {ativo ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </Icone>
      <Icone titulo="Excluir" perigo disabled={pendente} onClick={() => { setErro(undefined); setConfirmar(true); }}>
        <Trash2 className="size-4" />
      </Icone>
    </div>
  );
}
