import "server-only";
import type { Derivacao, EquipamentoNoSnapshot, ValorDeResposta } from "@zanatta/engine";
import { db } from "@/server/db";
import { urlDaImagem } from "@/server/arquivos/armazenamento";
import { paraPergunta, paraPerguntaDeModelo } from "@/features/perguntas/conversao";
import type { BibliotecaDoConfigurador } from "./tipos";

const ordemPadrao = [{ ordem: "asc" as const }, { nome: "asc" as const }];

const TIPO = { NENHUM: "nenhum", INDIVIDUAL: "individual", COLETIVO: "coletivo" } as const;

function derivacao(tipo: keyof typeof TIPO | null, porGrupo: number | null): Derivacao | null {
  return tipo ? { tipo: TIPO[tipo], porGrupo } : null;
}

/**
 * Recorte da biblioteca para o configurador. Inclui equipamentos e modelos
 * inativos no snapshot (para que rascunhos antigos mostrem a pendência),
 * mas o catálogo do vendedor só lista os ativos.
 */
export async function carregarBibliotecaDoConfigurador(): Promise<BibliotecaDoConfigurador> {
  const [categorias, equipamentos, kits, imagens, tiposDePainel, funcoes] = await Promise.all([
    db.categoria.findMany({
      where: { ativo: true },
      orderBy: ordemPadrao,
      select: { id: true, nome: true, descricao: true, paiId: true, ordem: true },
    }),
    db.equipamento.findMany({
      orderBy: ordemPadrao,
      include: {
        imagem: { select: { chave: true } },
        perguntas: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { chave: "asc" }] },
        modelos: {
          orderBy: ordemPadrao,
          include: {
            imagem: { select: { chave: true } },
            perguntas: { where: { ativo: true }, orderBy: [{ ordem: "asc" }, { chave: "asc" }] },
          },
        },
      },
    }),
    db.kit.findMany({
      where: { ativo: true },
      orderBy: ordemPadrao,
      include: { imagem: { select: { chave: true } }, itens: { orderBy: { ordem: "asc" } } },
    }),
    db.imagemInterativa.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      include: { imagem: true, hotspots: { orderBy: { ordem: "asc" } } },
    }),
    db.tipoDePainel.findMany({ orderBy: ordemPadrao, select: { id: true, nome: true, ativo: true } }),
    db.funcaoDeControle.findMany({ orderBy: ordemPadrao, select: { id: true, codigo: true, nome: true, ativo: true } }),
  ]);

  const snapshot: Record<string, EquipamentoNoSnapshot> = {};
  for (const e of equipamentos) {
    snapshot[e.id] = {
      id: e.id,
      codigo: e.codigo,
      nome: e.nome,
      ativo: e.ativo,
      perguntas: e.perguntas.map(paraPergunta),
      acionamento: derivacao(e.acionamento, e.acionamentoPorGrupo),
      protecao: derivacao(e.protecao, e.protecaoPorGrupo),
      modelos: e.modelos.map((m) => ({
        id: m.id,
        nome: m.nome,
        ativo: m.ativo,
        atributos: (m.atributos ?? {}) as Record<string, unknown>,
        perguntas: m.perguntas.map(paraPerguntaDeModelo),
        acionamento: derivacao(m.acionamento, m.acionamentoPorGrupo),
        protecao: derivacao(m.protecao, m.protecaoPorGrupo),
      })),
    };
  }

  return {
    categorias,
    equipamentos: equipamentos.map((e) => ({
      id: e.id,
      codigo: e.codigo,
      nome: e.nome,
      descricao: e.descricao,
      tipo: e.tipo,
      categoriaId: e.categoriaId,
      ativo: e.ativo,
      isDemo: e.isDemo,
      imagemUrl: urlDaImagem(e.imagem?.chave),
      modelos: e.modelos.map((m) => ({
        id: m.id,
        nome: m.nome,
        codigo: m.codigo,
        ativo: m.ativo,
        isDemo: m.isDemo,
        imagemUrl: urlDaImagem(m.imagem?.chave),
      })),
    })),
    kits: kits.map((k) => ({
      id: k.id,
      nome: k.nome,
      descricao: k.descricao,
      categoriaId: k.categoriaId,
      isDemo: k.isDemo,
      imagemUrl: urlDaImagem(k.imagem?.chave),
      itens: k.itens.map((i) => ({
        equipamentoId: i.equipamentoId,
        modeloId: i.modeloId,
        quantidade: i.quantidade,
        respostas: (i.respostas ?? {}) as Record<string, ValorDeResposta | null>,
      })),
    })),
    imagens: imagens.map((i) => ({
      id: i.id,
      nome: i.nome,
      url: urlDaImagem(i.imagem.chave)!,
      largura: i.imagem.largura,
      altura: i.imagem.altura,
      textoAlternativo: i.imagem.textoAlternativo,
      categoriaId: i.categoriaId,
      equipamentoId: i.equipamentoId,
      isDemo: i.isDemo,
      hotspots: i.hotspots.map((h) => ({
        id: h.id,
        rotulo: h.rotulo,
        forma: h.forma,
        x: h.x,
        y: h.y,
        largura: h.largura,
        altura: h.altura,
        alvoTipo: h.alvoTipo,
        alvoId: h.alvoId,
        alvoValor: h.alvoValor,
      })),
    })),
    tiposDePainel,
    funcoes,
    snapshot: {
      versao: new Date().toISOString(),
      equipamentos: snapshot,
      tiposDePainel: Object.fromEntries(tiposDePainel.map((t) => [t.id, t])),
      funcoes: Object.fromEntries(funcoes.map((f) => [f.id, f])),
    },
  };
}
