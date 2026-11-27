/**
 * Estágio 8 (parte): descritivo técnico (Fase 10).
 *
 * Modelos de texto com variáveis ({{quantidade}}, {{modelo.nome}},
 * {{ambiente.nome}}, {{controlador.modelo}}…) e uma condição de uso, ligados
 * a equipamento, modelo, controlador, tipo de painel ou projeto. O gerador
 * monta as seções numa ordem fixa, com concordância de plural por
 * {{plural:singular|plural}}. Texto editado à mão fica salvo como
 * substituição; se o texto gerado mudar depois, o trecho é marcado como
 * possivelmente desatualizado.
 */
import { avaliarCondicao, type Condicao } from "../regras/condicao";
import type { Valor } from "../regras/contexto";
import type { DonoDaRegra } from "../materiais/tipos";
import type { ConfiguracaoDoProjeto, Id, Pendencia, SnapshotDaBiblioteca } from "../types";

export const SECOES_DO_DESCRITIVO = [
  { id: "objeto", titulo: "Objeto" },
  { id: "equipamentos", titulo: "Equipamentos" },
  { id: "paineis", titulo: "Painéis elétricos" },
  { id: "automacao", titulo: "Controle e automação" },
  { id: "servicos", titulo: "Serviços" },
  { id: "observacoes", titulo: "Observações" },
] as const;
export type SecaoDoDescritivo = (typeof SECOES_DO_DESCRITIVO)[number]["id"];

export interface ModeloDeTextoNoSnapshot {
  id: Id;
  secao: SecaoDoDescritivo;
  dono: DonoDaRegra;
  texto: string;
  condicao: Condicao | null;
  ordem: number;
  ativo: boolean;
}

/** Texto editado à mão: substitui o gerado. "base" é o texto gerado no momento da edição. */
export interface EdicaoDoDescritivo {
  texto: string;
  base: string;
}

export interface ParagrafoDoDescritivo {
  /** modelo de texto + contexto: estável entre recálculos. */
  chave: string;
  modeloId: Id;
  /** Texto final (editado, se houver). */
  texto: string;
  /** Texto gerado pelo modelo. */
  gerado: string;
  editado: boolean;
  /** Editado à mão e o texto gerado mudou desde a edição. */
  desatualizado: boolean;
}

export interface SecaoGerada {
  id: SecaoDoDescritivo;
  titulo: string;
  paragrafos: ParagrafoDoDescritivo[];
}

type Ctx = Record<string, Valor>;

const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

function formatar(v: Valor): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return NUM.format(v);
  if (typeof v === "boolean") return v ? "sim" : "não";
  if (Array.isArray(v)) return v.length ? v.join(", ") : null;
  return v;
}

/** Substitui as variáveis do texto. Devolve o texto e as variáveis sem valor. */
export function preencherTexto(texto: string, ctx: Ctx): { texto: string; faltando: string[] } {
  const faltando: string[] = [];
  const saida = texto.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, expr: string) => {
    if (expr.startsWith("plural:")) {
      const [singular = "", plural = singular] = expr.slice(7).split("|");
      const q = ctx.quantidade;
      return typeof q === "number" && q !== 1 ? plural : singular;
    }
    const v = formatar(ctx[expr]);
    if (v === null) {
      faltando.push(expr);
      return "";
    }
    return v;
  });
  return { texto: saida.replace(/[ \t]{2,}/g, " ").trim(), faltando };
}

const juntar = (nomes: string[]) => (nomes.length <= 1 ? (nomes[0] ?? "") : `${nomes.slice(0, -1).join(", ")} e ${nomes.at(-1)}`);

export function calcularDescritivo(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
  contextos: ReadonlyMap<Id, Ctx>,
  ctxProjeto: Ctx,
): { descritivo: SecaoGerada[]; pendencias: Pendencia[] } {
  const pendencias: Pendencia[] = [];
  const modelos = (snapshot.modelosDeTexto ?? []).filter((m) => m.ativo).sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id));
  const edicoes = config.descritivo?.edicoes ?? {};
  const porSecao = new Map<SecaoDoDescritivo, ParagrafoDoDescritivo[]>();
  const nomeDoPainel = (id?: Id | null) => (id ? config.paineis?.find((p) => p.id === id)?.identificacao : undefined);
  const nomesDosAmbientes = (ids?: Id[]) => juntar((ids ?? []).map((id) => config.ambientes?.find((a) => a.id === id)?.nome).filter((n): n is string => !!n));

  const contextosDoModelo = (m: ModeloDeTextoNoSnapshot): { chave: string; ctx: Ctx }[] => {
    const dono = m.dono;
    if (dono.tipo === "equipamento" || dono.tipo === "modelo") {
      return config.instancias
        .filter((i) => (dono.tipo === "equipamento" ? i.equipamentoId === dono.id : i.modeloId === dono.id) && Number.isInteger(i.quantidade) && i.quantidade > 0)
        .map((i) => {
          const eq = snapshot.equipamentos?.[i.equipamentoId];
          const modelo = eq?.modelos.find((x) => x.id === i.modeloId);
          return {
            chave: `i:${i.id}`,
            ctx: {
              ...(contextos.get(i.id) ?? ctxProjeto),
              quantidade: i.quantidade,
              "equipamento.nome": eq?.nome,
              "modelo.nome": modelo?.nome,
              "ambiente.nome": nomesDosAmbientes(i.ambientes),
              "painel.identificacao": nomeDoPainel(i.painelId),
              fornecimento: i.fornecimento === "existente" ? "existente no cliente" : "fornecido",
            },
          };
        });
    }
    if (dono.tipo === "controlador") {
      return (config.controladores ?? [])
        .filter((c) => c.controladorId && c.controladorId === dono.id)
        .map((c) => {
          const lib = snapshot.controladores?.[c.controladorId!];
          return {
            chave: `c:${c.id}`,
            ctx: {
              ...ctxProjeto,
              quantidade: 1,
              "controlador.nome": c.nome,
              "controlador.modelo": lib?.nome,
              "controlador.codigo": lib?.codigo,
              "controlador.tipo": lib?.tipo,
              "controlador.grupos": (config.grupos ?? []).filter((g) => g.controladorId === c.id).length,
              "painel.identificacao": nomeDoPainel(c.painelId),
            },
          };
        });
    }
    if (dono.tipo === "tipoDePainel") {
      return (config.paineis ?? [])
        .filter((p) => p.tipoId === dono.id)
        .map((p) => ({
          chave: `p:${p.id}`,
          ctx: {
            ...ctxProjeto,
            quantidade: 1,
            "painel.identificacao": p.identificacao,
            "painel.tipo": snapshot.tiposDePainel?.[p.tipoId ?? ""]?.nome,
            "painel.tensao": p.tensao,
            "painel.equipamentos": config.instancias.filter((i) => i.painelId === p.id).reduce((s, i) => s + (i.quantidade > 0 ? i.quantidade : 0), 0),
            "ambiente.nome": nomesDosAmbientes(p.ambientes),
          },
        }));
    }
    return [
      {
        chave: "projeto",
        ctx: {
          ...ctxProjeto,
          quantidade: config.instancias.reduce((s, i) => s + (i.quantidade > 0 ? i.quantidade : 0), 0),
          "ambiente.nome": nomesDosAmbientes(config.ambientes?.map((a) => a.id)),
        },
      },
    ];
  };

  for (const m of modelos) {
    for (const { chave: ctxChave, ctx } of contextosDoModelo(m)) {
      if (!avaliarCondicao(m.condicao, ctx)) continue;
      const { texto: gerado, faltando } = preencherTexto(m.texto, ctx);
      if (faltando.length) {
        pendencias.push({
          codigo: "TEXTO_VARIAVEL_SEM_VALOR",
          gravidade: "informativa",
          mensagem: `Um trecho do descritivo usa variáveis sem valor neste orçamento: ${[...new Set(faltando)].join(", ")}.`,
          referencia: m.id,
        });
      }
      const chave = `${m.id}:${ctxChave}`;
      const edicao = edicoes[chave];
      const p: ParagrafoDoDescritivo = {
        chave,
        modeloId: m.id,
        texto: edicao ? edicao.texto : gerado,
        gerado,
        editado: !!edicao,
        desatualizado: !!edicao && edicao.base !== gerado,
      };
      if (p.desatualizado) {
        pendencias.push({
          codigo: "TEXTO_EDITADO_DESATUALIZADO",
          gravidade: "advertencia",
          mensagem: "Um trecho editado à mão do descritivo pode estar desatualizado: a configuração mudou depois da edição.",
          referencia: chave,
        });
      }
      porSecao.set(m.secao, [...(porSecao.get(m.secao) ?? []), p]);
    }
  }

  // Edições de trechos que não existem mais não são aplicadas em silêncio.
  const existentes = new Set([...porSecao.values()].flat().map((p) => p.chave));
  for (const chave of Object.keys(edicoes)) {
    if (!existentes.has(chave)) {
      pendencias.push({
        codigo: "TEXTO_EDITADO_SEM_TRECHO",
        gravidade: "advertencia",
        mensagem: "Um trecho editado à mão deixou de existir após mudanças no projeto e não aparece no descritivo.",
        referencia: chave,
      });
    }
  }

  return {
    descritivo: SECOES_DO_DESCRITIVO.map((s) => ({ id: s.id, titulo: s.titulo, paragrafos: porSecao.get(s.id) ?? [] })).filter((s) => s.paragrafos.length > 0),
    pendencias,
  };
}

/** Edição imutável: salva o texto editado de um trecho (ou restaura o gerado com texto = null). */
export function editarTrechoDoDescritivo(c: ConfiguracaoDoProjeto, chave: string, texto: string | null, base: string): ConfiguracaoDoProjeto {
  const edicoes = { ...(c.descritivo?.edicoes ?? {}) };
  if (texto === null) delete edicoes[chave];
  else edicoes[chave] = { texto, base };
  return { ...c, descritivo: { ...c.descritivo, edicoes } };
}
