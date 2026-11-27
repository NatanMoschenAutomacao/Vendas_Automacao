import { obterUsuarioAtual } from "@/server/auth/dal";
import { pode } from "@/server/auth/permissions";
import { carregarParaDocumento } from "@/features/documentos/dados";
import { montarDocumento, type TipoDeDocumento } from "@/features/documentos/modelo";
import { gerarPdf } from "@/features/documentos/pdf";
import { gerarPlanilha } from "@/features/documentos/excel";

const ARQUIVOS: Record<string, { tipo: TipoDeDocumento; formato: "pdf" | "xlsx" }> = {
  "proposta.pdf": { tipo: "proposta", formato: "pdf" },
  "interno.pdf": { tipo: "interno", formato: "pdf" },
  "listas.xlsx": { tipo: "proposta", formato: "xlsx" },
  "interno.xlsx": { tipo: "interno", formato: "xlsx" },
};

/** Download dos documentos. A permissão é conferida aqui, no servidor. */
export async function GET(_: Request, ctx: RouteContext<"/orcamentos/[id]/documentos/[arquivo]">) {
  const u = await obterUsuarioAtual();
  if (!u || u.trocarSenha || !pode(u.perfil, "orcamento:ver")) return new Response("Não autorizado.", { status: 401 });
  const { id, arquivo } = await ctx.params;
  const alvo = ARQUIVOS[arquivo];
  if (!alvo || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Não encontrado.", { status: 404 });
  // Orçamento interno tem custo e margem: só quem vê custo.
  if (alvo.tipo === "interno" && !pode(u.perfil, "precos:ver-custo")) return new Response("Sem permissão.", { status: 403 });
  const dados = await carregarParaDocumento(id, u);
  if (!dados) return new Response("Não encontrado.", { status: 404 });
  const doc = montarDocumento({ tipo: alvo.tipo, previa: dados.previa, cabecalho: dados.cabecalho, configuracao: dados.configuracao, resultado: dados.resultado, snapshot: dados.snapshot });
  const nome = `${alvo.tipo === "proposta" ? "proposta" : "orcamento-interno"}-${dados.cabecalho.numero}-rev${dados.cabecalho.revisao}${dados.previa ? "-previa" : ""}.${alvo.formato}`;
  const corpo = alvo.formato === "pdf" ? await gerarPdf(doc) : await gerarPlanilha(doc);
  return new Response(new Uint8Array(corpo), {
    headers: {
      "Content-Type": alvo.formato === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
