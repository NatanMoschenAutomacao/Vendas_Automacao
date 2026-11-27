/**
 * Monta os dados dos documentos (proposta e orçamento interno) a partir do
 * resultado do motor. Função pura: PDF, Excel e tela usam os mesmos textos
 * decimais do motor, por isso os valores batem (cenário 18).
 */
import type { ConfiguracaoDoProjeto, LinhaDeMaterial, Pendencia, ResultadoDePrecos, ResultadoDoCalculo, SecaoGerada, SnapshotDaBiblioteca } from "@zanatta/engine";

export type TipoDeDocumento = "proposta" | "interno";

export interface CabecalhoDoDocumento {
  numero: string;
  revisao: number;
  cliente: string;
  empresa: string | null;
  projeto: string;
  cidade: string | null;
  uf: string | null;
  vendedor: string;
  /** Data por extenso curto (dd/mm/aaaa). */
  data: string;
  status: string;
}

export interface LinhaDaListaDetalhada {
  origem: string;
  codigo: string;
  descricao: string;
  unidade: string;
  quantidade: number;
}

export interface DocumentoDoOrcamento {
  tipo: TipoDeDocumento;
  /** Não emitido: os documentos saem marcados como prévia. */
  previa: boolean;
  cabecalho: CabecalhoDoDocumento;
  descritivo: SecaoGerada[];
  precos: ResultadoDePrecos;
  consolidado: { codigo: string; descricao: string; unidade: string; quantidade: number }[];
  detalhada: LinhaDaListaDetalhada[];
  io: { painel: string; recurso: string; quantidade: number }[];
  condicoes: { rotulo: string; valor: string }[];
  pendencias: Pendencia[];
}

const ORIGEM = { regra: "Regra", fornecimento: "Fornecimento", ajuste: "Ajuste manual", controlador: "Controlador", cartao: "Cartão de expansão", manual: "Manual" } as const;

export function origemDaLinha(l: LinhaDeMaterial, config: ConfiguracaoDoProjeto, snapshot: SnapshotDaBiblioteca): string {
  const o = l.origem;
  const partes: string[] = [];
  if (o.painelId) partes.push(`Painel ${config.paineis?.find((p) => p.id === o.painelId)?.identificacao ?? "?"}`);
  if (o.instanciaId) {
    const i = config.instancias.find((x) => x.id === o.instanciaId);
    partes.push(i ? (snapshot.equipamentos?.[i.equipamentoId]?.nome ?? "Equipamento") : "Equipamento");
  }
  if (o.controladorId) partes.push(config.controladores?.find((c) => c.id === o.controladorId)?.nome ?? "Controlador");
  if (o.grupoId) partes.push(`Grupo ${config.grupos?.find((g) => g.id === o.grupoId)?.nome ?? "?"}`);
  if (o.setorId) partes.push(`Setor ${config.setores?.find((s) => s.id === o.setorId)?.nome ?? "?"}`);
  if (o.ambienteId) partes.push(config.ambientes?.find((a) => a.id === o.ambienteId)?.nome ?? "Ambiente");
  partes.push(o.tipo === "regra" && o.regraCodigo ? `regra ${o.regraCodigo}` : ORIGEM[o.tipo]);
  return partes.join(" · ");
}

/** Proposta para o cliente: sem custo, margem nem pendências internas. */
function semCustos(p: ResultadoDePrecos): ResultadoDePrecos {
  const limpo = structuredClone(p);
  delete limpo.custoTotal;
  delete limpo.margem;
  for (const l of limpo.linhas) {
    delete l.custoUnitario;
    delete l.custoTotal;
  }
  for (const g of limpo.grupos) delete g.custo;
  limpo.custosOcultos = true;
  return limpo;
}

export function montarDocumento(entrada: {
  tipo: TipoDeDocumento;
  previa: boolean;
  cabecalho: CabecalhoDoDocumento;
  configuracao: ConfiguracaoDoProjeto;
  resultado: ResultadoDoCalculo;
  snapshot: SnapshotDaBiblioteca;
}): DocumentoDoOrcamento {
  const { tipo, configuracao: c, resultado: r, snapshot: s } = entrada;
  const nomeDoPainel = (id: string | null) => (id ? (c.paineis?.find((p) => p.id === id)?.identificacao ?? "?") : "Sem painel");
  const com = c.comercial ?? {};
  return {
    tipo,
    previa: entrada.previa,
    cabecalho: entrada.cabecalho,
    descritivo: r.descritivo,
    precos: tipo === "proposta" ? semCustos(r.precos) : r.precos,
    consolidado: r.materiais.consolidado.map(({ codigo, descricao, unidade, quantidade }) => ({ codigo, descricao, unidade, quantidade })),
    detalhada: r.materiais.linhas
      .map((l) => ({ origem: origemDaLinha(l, c, s), codigo: l.codigo, descricao: l.descricao, unidade: l.unidade, quantidade: l.quantidade }))
      .sort((a, b) => a.origem.localeCompare(b.origem) || a.codigo.localeCompare(b.codigo)),
    io: r.materiais.io
      .map((x) => ({ painel: nomeDoPainel(x.painelId), recurso: x.codigo, quantidade: x.quantidade }))
      .sort((a, b) => a.painel.localeCompare(b.painel) || a.recurso.localeCompare(b.recurso)),
    condicoes: (
      [
        ["Condições de pagamento", com.condicoesDePagamento],
        ["Prazo de entrega", com.prazoDeEntrega],
        ["Garantia", com.garantia],
        ["Validade da proposta", com.validade],
      ] as const
    ).flatMap(([rotulo, valor]) => (valor ? [{ rotulo, valor }] : [])),
    pendencias: tipo === "interno" ? r.pendencias : [],
  };
}
