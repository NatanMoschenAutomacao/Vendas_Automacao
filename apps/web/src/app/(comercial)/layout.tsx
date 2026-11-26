import { exigirUsuario } from "@/server/auth/dal";
import { BarraSuperior } from "@/ui/barra-superior";

export default async function LayoutComercial({ children }: LayoutProps<"/">) {
  const usuario = await exigirUsuario();
  return (
    <>
      <BarraSuperior usuario={usuario} />
      <main className="mx-auto w-full max-w-[110rem] flex-1 px-4 py-10 sm:px-6">{children}</main>
    </>
  );
}
