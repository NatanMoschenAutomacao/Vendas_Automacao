import type { Metadata } from "next";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { pode } from "@/server/auth/permissions";
import { salvarReservaPadrao } from "@/features/configuracoes/actions";
import { lerReservaPadrao } from "@/features/configuracoes/dados";
import { FormReservaPadrao } from "@/features/configuracoes/formulario";
import { salvarLimiteDeDesconto, salvarRegraComercial } from "@/features/precos/actions";
import { lerImpostos, lerLimiteDeDesconto, lerRegraComercial } from "@/features/precos/dados";
import { EditorDeImpostos, FormLimiteDeDesconto, FormRegraComercial } from "@/features/precos/formularios";
import { CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Configurações gerais" };

export default async function PaginaDeConfiguracoes() {
  const usuario = await exigirPermissaoNaPagina("configuracoes:gerenciar");
  const comercial = pode(usuario.perfil, "precos:gerenciar");
  const [reserva, regra, impostos, limite] = await Promise.all([lerReservaPadrao(), lerRegraComercial(), lerImpostos(), lerLimiteDeDesconto()]);
  return (
    <>
      <CabecalhoDePagina titulo="Configurações gerais" descricao="Valores padrão usados por todos os orçamentos." />
      <div className="flex max-w-3xl flex-col gap-6">
        <Card className="p-6">
          <h2 className="mb-1 font-medium text-grafite-900">Reserva técnica de I/O</h2>
          <p className="mb-4 text-sm text-gray-500">
            Somada à necessidade de cada controlador antes de escolher os cartões. O administrador técnico pode ajustar por projeto.
          </p>
          <FormReservaPadrao acao={salvarReservaPadrao} inicial={reserva} />
        </Card>
        {comercial && (
          <>
            <Card className="p-6">
              <h2 className="mb-1 font-medium text-grafite-900">Regra comercial</h2>
              <p className="mb-4 text-sm text-gray-500">
                Aplicada só aos itens com preço em &quot;custo + regra&quot;. Itens em venda fixa usam o preço de venda cadastrado, sem nada por cima.
              </p>
              <FormRegraComercial acao={salvarRegraComercial} inicial={regra} />
            </Card>
            <Card className="p-6">
              <h2 className="mb-1 font-medium text-grafite-900">Impostos</h2>
              <p className="mb-4 text-sm text-gray-500">
                Linhas percentuais por grupo, somadas ao valor líquido do grupo (depois dos descontos do grupo). Não há cálculo fiscal: os percentuais são definidos pelo comercial ou
                contábil.
              </p>
              <EditorDeImpostos inicial={impostos} />
            </Card>
            <Card className="p-6">
              <h2 className="mb-1 font-medium text-grafite-900">Limite de desconto do vendedor</h2>
              <p className="mb-4 text-sm text-gray-500">O vendedor só aplica descontos percentuais até este limite em cada grupo e no total. Acima disso, só o administrador técnico.</p>
              <FormLimiteDeDesconto acao={salvarLimiteDeDesconto} inicial={limite.percentual} />
            </Card>
          </>
        )}
      </div>
    </>
  );
}
