import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { ListaDeRegras } from "@/features/regras/lista";
import { CabecalhoDePagina, Card } from "@/ui/card";

export const metadata: Metadata = { title: "Regras de composição" };

const ordem = [{ estagio: "asc" as const }, { prioridade: "asc" as const }, { codigo: "asc" as const }];

export default async function PaginaDeRegras() {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const [regras, tipos] = await Promise.all([
    db.regra.findMany({
      orderBy: ordem,
      include: {
        equipamento: { select: { id: true, nome: true } },
        modelo: { select: { id: true, nome: true, equipamento: { select: { nome: true } } } },
        tipoDePainel: { select: { id: true, nome: true } },
        controlador: { select: { id: true, item: { select: { descricao: true } } } },
      },
    }),
    db.tipoDePainel.findMany({ where: { ativo: true }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true } }),
  ]);
  const grupos = new Map<string, { titulo: string; href?: string; regras: typeof regras }>();
  for (const r of regras) {
    const [chave, titulo, href] =
      r.donoTipo === "EQUIPAMENTO"
        ? [`e:${r.equipamentoId}`, `Equipamento: ${r.equipamento?.nome}`, `/admin/equipamentos/${r.equipamentoId}?aba=materiais`]
        : r.donoTipo === "MODELO"
          ? [`m:${r.modeloId}`, `Modelo: ${r.modelo?.equipamento.nome} › ${r.modelo?.nome}`, undefined]
          : r.donoTipo === "TIPO_DE_PAINEL"
            ? [`t:${r.tipoDePainelId}`, `Tipo de painel: ${r.tipoDePainel?.nome}`, undefined]
            : r.donoTipo === "CONTROLADOR"
              ? [`c:${r.controladorId}`, `Controlador: ${r.controlador?.item.descricao}`, `/admin/controladores/${r.controladorId}`]
              : ["projeto", "Projeto (componentes gerais)", undefined];
    const g = grupos.get(chave) ?? { titulo, href, regras: [] };
    g.regras.push(r);
    grupos.set(chave, g);
  }
  return (
    <>
      <CabecalhoDePagina
        titulo="Regras de composição"
        descricao="Cada regra gera materiais ou recursos de automação a partir de uma base (por equipamento, acionamento, painel…). Regras de equipamento e modelo são criadas na página do equipamento."
        acoes={
          <Link href="/admin/regras/nova?dono=projeto" className="inline-flex h-10 items-center gap-2 rounded-lg bg-marca-600 px-4 text-sm font-medium text-white hover:bg-marca-700">
            <Plus className="size-4" /> Nova regra do projeto
          </Link>
        }
      />
      <div className="flex flex-col gap-6">
        {tipos.length > 0 && (
          <Card className="p-4">
            <p className="mb-2 text-sm font-medium text-grafite-900">Nova regra por tipo de painel</p>
            <div className="flex flex-wrap gap-2">
              {tipos.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/regras/nova?dono=tipoDePainel&id=${t.id}`}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 text-sm hover:bg-gray-50"
                >
                  <Plus className="size-3.5" /> {t.nome}
                </Link>
              ))}
            </div>
          </Card>
        )}
        {grupos.size === 0 && <p className="text-sm text-gray-500">Nenhuma regra cadastrada.</p>}
        {[...grupos.values()].map((g) => (
          <Card key={g.titulo} className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
              <h2 className="font-medium text-grafite-900">{g.titulo}</h2>
              {g.href && (
                <Link href={g.href} className="text-sm text-marca-700 hover:underline">
                  Abrir
                </Link>
              )}
            </div>
            <ListaDeRegras regras={g.regras} vazio="" rotulo={`Regras de ${g.titulo}`} />
          </Card>
        ))}
      </div>
    </>
  );
}
