import type { Metadata } from "next";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { salvarReservaPadrao } from "@/features/configuracoes/actions";
import { lerReservaPadrao } from "@/features/configuracoes/dados";
import { FormReservaPadrao } from "@/features/configuracoes/formulario";
import { CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Configurações gerais" };

export default async function PaginaDeConfiguracoes() {
  await exigirPermissaoNaPagina("configuracoes:gerenciar");
  const reserva = await lerReservaPadrao();
  return (
    <>
      <CabecalhoDePagina titulo="Configurações gerais" descricao="Valores padrão usados por todos os orçamentos." />
      <Card className="max-w-3xl p-6">
        <h2 className="mb-1 font-medium text-grafite-900">Reserva técnica de I/O</h2>
        <p className="mb-4 text-sm text-gray-500">
          Somada à necessidade de cada controlador antes de escolher os cartões. O administrador técnico pode ajustar por projeto.
        </p>
        <FormReservaPadrao acao={salvarReservaPadrao} inicial={reserva} />
      </Card>
    </>
  );
}
