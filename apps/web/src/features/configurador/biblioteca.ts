import "server-only";
import type { Condicao, ControladorNoSnapshot, Derivacao, EquipamentoNoSnapshot, ModeloDeTextoNoSnapshot, RegraNoSnapshot, SnapshotDaBiblioteca, ValorDeResposta } from "@zanatta/engine";
import { donoDoBanco } from "@/features/regras/dados";
import { efeitoSchema, ESTAGIO_DO_BANCO } from "@/features/regras/schema";
import { lerReservaPadrao } from "@/features/configuracoes/dados";
import { carregarComercialDoSnapshot, ocultarCustos } from "@/features/precos/dados";
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
export async function carregarBibliotecaDoConfigurador({ verCusto }: { verCusto: boolean }): Promise<BibliotecaDoConfigurador> {
  const [categorias, equipamentos, kits, imagens, tiposDePainel, funcoes, itens, tiposDeRecurso, regras, controladores, cartoes, reservaPadrao, comercial, textos] = await Promise.all([
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
    db.itemDeCatalogo.findMany({
      orderBy: { codigo: "asc" },
      select: { id: true, codigo: true, descricao: true, unidade: true, fracionavel: true, ativo: true, grupoComercial: true },
    }),
    db.tipoDeRecurso.findMany({
      orderBy: [{ ordem: "asc" }, { codigo: "asc" }],
      select: { id: true, codigo: true, nome: true, fisico: true, ativo: true },
    }),
    db.regra.findMany({ where: { ativo: true }, orderBy: [{ prioridade: "asc" }, { codigo: "asc" }] }),
    db.controlador.findMany({
      include: {
        item: { select: { codigo: true, descricao: true } },
        recursos: true,
        saidas: { orderBy: { ordem: "asc" }, include: { funcoes: { select: { id: true } } } },
        modelosCompativeis: { select: { id: true } },
        cartoesCompativeis: { select: { id: true } },
      },
    }),
    db.cartaoDeExpansao.findMany({ include: { item: { select: { codigo: true, descricao: true } }, recursos: true } }),
    lerReservaPadrao(),
    carregarComercialDoSnapshot(),
    db.modeloDeTexto.findMany({ where: { ativo: true }, orderBy: [{ secao: "asc" }, { ordem: "asc" }, { criadoEm: "asc" }] }),
  ]);

  const TIPO_CONTROLADOR = { CONVENCIONAL: "convencional", DIGITAL: "digital", CLP: "clp", IRRIGACAO: "irrigacao", IHM: "ihm" } as const;
  const controladoresDoMotor: Record<string, ControladorNoSnapshot> = Object.fromEntries(
    controladores.map((c) => [
      c.id,
      {
        id: c.id,
        itemId: c.itemId,
        codigo: c.item.codigo,
        nome: c.item.descricao,
        tipo: TIPO_CONTROLADOR[c.tipo],
        ativo: c.ativo,
        tensoes: c.tensoes,
        protocolos: c.protocolos,
        recursos: Object.fromEntries(c.recursos.map((r) => [r.tipoRecursoId, r.quantidade])),
        saidas: c.saidas.map((s) => ({ id: s.id, codigo: s.codigo, funcoes: s.funcoes.map((f) => f.id) })),
        modelosCompativeis: c.modelosCompativeis.map((m) => m.id),
        barramento: c.barramento,
        maxModulos: c.maxModulos,
        consumoMaxBarramento: c.consumoMaxBarramento,
        cartoesCompativeis: c.cartoesCompativeis.map((k) => k.id),
      },
    ]),
  );

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
        itemId: m.itemId,
      })),
    };
  }

  const regrasDoMotor: RegraNoSnapshot[] = regras.map((r) => ({
    id: r.id,
    codigo: r.codigo,
    nome: r.nome,
    dono: donoDoBanco(r),
    estagio: ESTAGIO_DO_BANCO[r.estagio],
    base: r.base as RegraNoSnapshot["base"],
    condicao: (r.condicao ?? null) as Condicao | null,
    prioridade: r.prioridade,
    permiteRemocao: r.permiteRemocao,
    ativo: r.ativo,
    efeitos: (Array.isArray(r.efeitos) ? r.efeitos : []).flatMap((e) => {
      const p = efeitoSchema.safeParse(e);
      return p.success ? [p.data] : [];
    }),
  }));

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
    snapshot: (verCusto ? (s: SnapshotDaBiblioteca) => s : ocultarCustos)({
      ...comercial,
      versao: new Date().toISOString(),
      equipamentos: snapshot,
      tiposDePainel: Object.fromEntries(tiposDePainel.map((t) => [t.id, t])),
      funcoes: Object.fromEntries(funcoes.map((f) => [f.id, f])),
      itens: Object.fromEntries(
        itens.map(({ grupoComercial, ...i }) => [i.id, { ...i, grupo: grupoComercial === "SOFTWARE" ? ("software" as const) : ("material" as const) }]),
      ),
      tiposDeRecurso: Object.fromEntries(tiposDeRecurso.map((t) => [t.id, t])),
      regras: regrasDoMotor,
      controladores: controladoresDoMotor,
      cartoes: Object.fromEntries(
        cartoes.map((k) => [
          k.id,
          {
            id: k.id,
            itemId: k.itemId,
            codigo: k.item.codigo,
            nome: k.item.descricao,
            ativo: k.ativo,
            recursos: Object.fromEntries(k.recursos.map((r) => [r.tipoRecursoId, r.quantidade])),
            barramento: k.barramento,
            consumo: k.consumo,
          },
        ]),
      ),
      reservaPadrao,
      modelosDeTexto: textos.map((t) => ({
        id: t.id,
        secao: t.secao as ModeloDeTextoNoSnapshot["secao"],
        dono: donoDoBanco(t),
        texto: t.texto,
        condicao: (t.condicao ?? null) as Condicao | null,
        ordem: t.ordem,
        ativo: t.ativo,
      })),
    }),
  };
}
