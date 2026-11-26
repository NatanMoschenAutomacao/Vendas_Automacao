import { FileText } from "lucide-react";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { CabecalhoDePagina, Card } from "@/ui/card";

export default async function TelaInicial() {
  const u = await exigirPermissaoNaPagina("orcamento:ver");
  return (
    <>
      <CabecalhoDePagina
        titulo={`Olá, ${u.nome.split(" ")[0]}`}
        descricao="Monte visualmente a solução do cliente; o sistema calcula materiais e valores."
      />
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-gray-50 text-gray-400">
          <FileText className="size-6" />
        </span>
        <h2 className="font-medium text-grafite-800">Nenhum orçamento ainda</h2>
        <p className="max-w-md text-sm text-gray-500">
          A criação de orçamentos chega com o configurador visual (Fase 04). Antes disso, a equipe de automação
          cadastra categorias, equipamentos e perguntas na Administração.
        </p>
      </Card>
    </>
  );
}
