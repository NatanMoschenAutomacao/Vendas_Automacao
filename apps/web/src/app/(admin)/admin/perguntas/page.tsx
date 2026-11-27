import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Perguntas e regras" };

export default async function PaginaPerguntas() {
  await exigirPermissaoNaPagina("biblioteca:ver");
  const equipamentos = await db.equipamento.findMany({
    orderBy: [{ categoria: { nome: "asc" } }, { ordem: "asc" }],
    select: {
      id: true,
      nome: true,
      codigo: true,
      ativo: true,
      categoria: { select: { nome: true } },
      _count: { select: { perguntas: true } },
      modelos: { select: { _count: { select: { perguntas: true } } } },
    },
  });
  return (
    <>
      <CabecalhoDePagina
        titulo="Perguntas e regras"
        descricao="As perguntas são cadastradas em cada equipamento (aba Perguntas) e podem ser ajustadas por modelo."
      />
      <Card className="overflow-hidden">
        {equipamentos.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-gray-500">Cadastre um equipamento primeiro.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-2 font-medium">Equipamento</th>
                <th className="px-4 py-2 font-medium">Categoria</th>
                <th className="px-4 py-2 text-right font-medium">Perguntas</th>
                <th className="px-4 py-2 text-right font-medium">Ajustes nos modelos</th>
              </tr>
            </thead>
            <tbody>
              {equipamentos.map((e) => (
                <tr key={e.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/equipamentos/${e.id}?aba=perguntas`} className="font-medium text-grafite-800 hover:text-marca-700">
                      {e.nome}
                    </Link>
                    <span className="ml-2 text-xs text-gray-400">{e.codigo}</span>
                    {!e.ativo && <Badge className="ml-2">Inativo</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600">{e.categoria.nome}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{e._count.perguntas}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{e.modelos.reduce((s, m) => s + m._count.perguntas, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="mt-4 text-sm text-gray-500">
        As regras de recursos, materiais, serviços e preços usam o mesmo construtor de condições e entram nas fases 06 a 09.
      </p>
    </>
  );
}
