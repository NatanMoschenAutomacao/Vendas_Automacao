import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/server/db";
import { exigirPermissaoNaPagina } from "@/server/auth/dal";
import { SECOES_DO_DESCRITIVO } from "@zanatta/engine";
import { AcoesDoModeloDeTexto } from "@/features/modelos-de-texto/editor";
import { ROTULO_DONO } from "@/features/regras/schema";
import { donoDoBanco } from "@/features/regras/dados";
import { Badge, CabecalhoDePagina, Card } from "@/ui/card";
import { Button } from "@/ui/button";
import { Select } from "@/ui/input";

export const metadata: Metadata = { title: "Modelos de texto" };

export default async function PaginaDeModelosDeTexto() {
  await exigirPermissaoNaPagina("biblioteca:gerenciar");
  const [modelos, equipamentos, tipos, controladores] = await Promise.all([
    db.modeloDeTexto.findMany({
      orderBy: [{ secao: "asc" }, { ordem: "asc" }, { criadoEm: "asc" }],
      include: {
        equipamento: { select: { nome: true } },
        modelo: { select: { nome: true, equipamento: { select: { nome: true } } } },
        tipoDePainel: { select: { nome: true } },
        controlador: { select: { item: { select: { descricao: true } } } },
      },
    }),
    db.equipamento.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true, modelos: { orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true } } } }),
    db.tipoDePainel.findMany({ orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { id: true, nome: true } }),
    db.controlador.findMany({ orderBy: { item: { codigo: "asc" } }, select: { id: true, item: { select: { descricao: true } } } }),
  ]);
  const nomeDoDono = (m: (typeof modelos)[number]) =>
    m.equipamento?.nome ?? (m.modelo ? `${m.modelo.equipamento.nome} › ${m.modelo.nome}` : null) ?? m.tipoDePainel?.nome ?? m.controlador?.item.descricao ?? "Projeto";
  return (
    <>
      <CabecalhoDePagina
        titulo="Modelos de texto"
        descricao="Trechos do descritivo técnico, com variáveis e condição de uso. Cada trecho pertence a um equipamento, modelo, tipo de painel, controlador ou ao projeto."
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-4">
          {SECOES_DO_DESCRITIVO.map((s) => {
            const daSecao = modelos.filter((m) => m.secao === s.id);
            return (
              <Card key={s.id} className="overflow-hidden" role="region" aria-label={`Seção ${s.titulo}`}>
                <h2 className="border-b border-gray-100 px-4 py-2 font-medium text-grafite-900">{s.titulo}</h2>
                {daSecao.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">Nenhum trecho.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {daSecao.map((m) => (
                      <li key={m.id} className="flex items-center gap-3 px-4 py-3" data-modelo-de-texto={m.id}>
                        <div className="min-w-0 flex-1">
                          <Link href={`/admin/modelos-de-texto/${m.id}`} className="line-clamp-2 text-sm text-grafite-900 hover:text-marca-700">
                            {m.texto}
                          </Link>
                          <p className="text-xs text-gray-500">
                            {ROTULO_DONO[donoDoBanco(m).tipo]}: {nomeDoDono(m)} · ordem {m.ordem}
                            {m.condicao ? " · com condição" : ""}
                          </p>
                        </div>
                        {!m.ativo && <Badge>Inativo</Badge>}
                        {m.isDemo && <Badge tom="demo">DEMO</Badge>}
                        <AcoesDoModeloDeTexto id={m.id} nome="este trecho" ativo={m.ativo} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
        <Card className="h-fit p-5">
          <h2 className="mb-3 font-medium text-grafite-900">Novo modelo de texto</h2>
          <form method="get" action="/admin/modelos-de-texto/novo" className="flex flex-col gap-3" aria-label="Novo modelo de texto">
            <label className="flex flex-col gap-1.5 text-sm font-medium text-grafite-700">
              Dono do texto
              <Select name="ref" required defaultValue="projeto">
                <option value="projeto">Projeto (uma vez por orçamento)</option>
                <optgroup label="Equipamentos">
                  {equipamentos.map((e) => (
                    <option key={e.id} value={`equipamento:${e.id}`}>
                      {e.nome}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Modelos">
                  {equipamentos.flatMap((e) =>
                    e.modelos.map((m) => (
                      <option key={m.id} value={`modelo:${m.id}`}>
                        {e.nome} › {m.nome}
                      </option>
                    )),
                  )}
                </optgroup>
                <optgroup label="Tipos de painel">
                  {tipos.map((t) => (
                    <option key={t.id} value={`tipoDePainel:${t.id}`}>
                      {t.nome}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Controladores">
                  {controladores.map((c) => (
                    <option key={c.id} value={`controlador:${c.id}`}>
                      {c.item.descricao}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </label>
            <div>
              <Button type="submit">Continuar</Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
