import Link from "next/link";
import { Logo } from "./logo";
import { MenuUsuario } from "./menu-usuario";
import { LinkNav } from "./link-nav";
import { pode } from "@/server/auth/permissions";
import type { UsuarioAtual } from "@/server/auth/dal";

export function BarraSuperior({ usuario }: { usuario: UsuarioAtual }) {
  return (
    <header className="sticky top-0 z-10 border-b border-gray-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[110rem] items-center gap-6 px-4 sm:px-6">
        <Link href="/">
          <Logo />
        </Link>
        <nav className="flex items-center gap-1">
          <LinkNav href="/" exato>
            Orçamentos
          </LinkNav>
          {pode(usuario.perfil, "biblioteca:gerenciar") && <LinkNav href="/admin">Administração</LinkNav>}
        </nav>
        <div className="ml-auto">
          <MenuUsuario usuario={usuario} />
        </div>
      </div>
    </header>
  );
}
