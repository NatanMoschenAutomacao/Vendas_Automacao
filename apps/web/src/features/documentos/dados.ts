import "server-only";
import { calcular, type ConfiguracaoDoProjeto, type ResultadoDoCalculo, type SnapshotDaBiblioteca } from "@zanatta/engine";
import { db } from "@/server/db";
import type { UsuarioAtual } from "@/server/auth/dal";
import { filtroDeAcesso, lerConfiguracao } from "@/features/orcamentos/queries";
import { ROTULO_STATUS } from "@/features/orcamentos/schema";
import { carregarBibliotecaDoConfigurador } from "@/features/configurador/biblioteca";
import { dataBR } from "@/features/precos/formato";
import type { CabecalhoDoDocumento } from "./modelo";

/**
 * Dados para os documentos. Orçamento emitido usa a emissão congelada
 * (configuração, snapshot e resultado gravados); os demais são recalculados
 * agora, com a biblioteca completa, e saem como prévia.
 */
export async function carregarParaDocumento(id: string, u: UsuarioAtual) {
  const o = await db.orcamento.findFirst({
    where: { id, ...filtroDeAcesso(u) },
    include: { vendedor: { select: { nome: true } }, revisoes: { orderBy: { numero: "desc" }, take: 1, include: { emissao: true } } },
  });
  if (!o) return null;
  const revisao = o.revisoes[0];
  if (!revisao) return null;
  let configuracao: ConfiguracaoDoProjeto;
  let snapshot: SnapshotDaBiblioteca;
  let resultado: ResultadoDoCalculo;
  const emissao = o.status === "EMITIDO" ? revisao.emissao : null;
  if (emissao) {
    configuracao = emissao.configuracao as unknown as ConfiguracaoDoProjeto;
    snapshot = emissao.snapshot as unknown as SnapshotDaBiblioteca;
    resultado = emissao.resultado as unknown as ResultadoDoCalculo;
  } else {
    configuracao = lerConfiguracao(revisao.configuracao);
    snapshot = (await carregarBibliotecaDoConfigurador({ verCusto: true })).snapshot;
    resultado = calcular(configuracao, snapshot);
  }
  const cabecalho: CabecalhoDoDocumento = {
    numero: o.numero,
    revisao: revisao.numero,
    cliente: o.cliente,
    empresa: o.empresa,
    projeto: o.projeto,
    cidade: o.cidade,
    uf: o.uf,
    vendedor: o.vendedor.nome,
    data: dataBR(emissao?.emitidoEm ?? new Date()),
    status: ROTULO_STATUS[o.status],
  };
  return { orcamento: o, revisao, emissao, configuracao, snapshot, resultado, cabecalho, previa: !emissao };
}
