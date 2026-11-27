import { analisarFormula, BASES_POR_DONO, ErroDeFormula, validarCondicao, variaveisDaFormula, type DescricaoDeVariavel, type DonoDaRegra } from "@zanatta/engine";
import type { DadosDaRegra } from "./schema";
import { variaveisDaRegra } from "./variaveis";

export interface ContextoDaRegra {
  dono: DonoDaRegra["tipo"];
  comuns: DescricaoDeVariavel[];
  itens: ReadonlySet<string>;
  recursos: ReadonlySet<string>;
}

function validarFormula(texto: string, nomes: ReadonlySet<string>): string | null {
  try {
    const no = analisarFormula(texto);
    const desconhecidas = [...variaveisDaFormula(no)].filter((v) => !nomes.has(v));
    if (desconhecidas.length) return `Variável desconhecida: ${desconhecidas.join(", ")}.`;
    return null;
  } catch (e) {
    if (e instanceof ErroDeFormula) return e.message;
    throw e;
  }
}

/** Regras de cadastro de uma regra de composição. Erros por campo ("efeito-N" para cada efeito). */
export function validarRegra(d: DadosDaRegra, ctx: ContextoDaRegra): Record<string, string> {
  const erros: Record<string, string> = {};
  if (!BASES_POR_DONO[ctx.dono].includes(d.base)) erros.base = "Essa base não se aplica a este dono.";
  const variaveis = variaveisDaRegra(ctx.comuns, ctx.dono, d.base);
  const nomes = new Set(variaveis.map((v) => v.nome));
  if (d.condicao) {
    const e = validarCondicao(d.condicao, variaveis);
    if (e.length) erros.condicao = e[0]!;
  }
  d.efeitos.forEach((ef, n) => {
    const chave = `efeito-${n}`;
    const erro = (m: string) => (erros[chave] ??= m);
    if (d.estagio === "recurso" && ef.acao !== "recurso") erro("Regras de recurso só geram recursos de automação.");
    if (d.estagio === "material" && ef.acao === "recurso") erro("Recursos de automação ficam em regras do estágio Recurso.");
    if (ef.acao === "recurso") {
      if (!ctx.recursos.has(ef.tipoRecursoId)) erro("Tipo de recurso não encontrado.");
    } else {
      if (!ctx.itens.has(ef.itemId)) erro("Item não encontrado no catálogo.");
      if (ef.acao === "substituir") {
        if (!ctx.itens.has(ef.substitutoId)) erro("Item substituto não encontrado.");
        if (ef.substitutoId === ef.itemId) erro("O substituto deve ser outro item.");
      }
    }
    if ("formula" in ef) {
      const m = validarFormula(ef.formula, nomes);
      if (m) erro(m);
    }
  });
  return erros;
}
