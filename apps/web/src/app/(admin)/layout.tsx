import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { BarraSuperior } from "@/ui/barra-superior";
import { LinkNav } from "@/ui/link-nav";
import { Badge } from "@/ui/card";
import { SECOES_ADMIN } from "@/features/secoes-admin";

export default async function LayoutAdmin({ children }: LayoutProps<"/">) {
  const usuario = await exigirPermissaoNaPagina("biblioteca:gerenciar");
  return (
    <>
      <BarraSuperior usuario={usuario} />
      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-10 sm:px-6">
        <aside className="hidden w-64 shrink-0 lg:block">
          <nav className="sticky top-24 flex flex-col gap-0.5">
            <LinkNav href="/admin" exato>
              Visão geral
            </LinkNav>
            {SECOES_ADMIN.map((s) =>
              s.href ? (
                <LinkNav key={s.titulo} href={s.href}>
                  {s.titulo}
                </LinkNav>
              ) : (
                <span
                  key={s.titulo}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-gray-400"
                >
                  {s.titulo}
                  <Badge>Fase {String(s.fase).padStart(2, "0")}</Badge>
                </span>
              ),
            )}
          </nav>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </>
  );
}
