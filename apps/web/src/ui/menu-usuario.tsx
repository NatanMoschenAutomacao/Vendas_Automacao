import Link from "next/link";
import { LogOut, KeyRound } from "lucide-react";
import { sair } from "@/features/auth/actions";
import { ROTULO_PERFIL } from "@/server/auth/permissions";
import type { UsuarioAtual } from "@/server/auth/dal";

export function MenuUsuario({ usuario }: { usuario: UsuarioAtual }) {
  return (
    <div className="flex items-center gap-1">
      <div className="mr-2 hidden text-right sm:block">
        <p className="text-sm font-medium text-grafite-800">{usuario.nome}</p>
        <p className="text-xs text-gray-500">{ROTULO_PERFIL[usuario.perfil]}</p>
      </div>
      <Link
        href="/trocar-senha"
        title="Trocar senha"
        className="grid size-9 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-grafite-800"
      >
        <KeyRound className="size-4" />
      </Link>
      <form action={sair}>
        <button
          type="submit"
          title="Sair"
          className="grid size-9 place-items-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-grafite-800"
        >
          <LogOut className="size-4" />
        </button>
      </form>
    </div>
  );
}
