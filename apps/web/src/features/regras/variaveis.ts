import type { BaseDeCalculo, DescricaoDeVariavel, DonoDaRegra } from "@zanatta/engine";

export const VARIAVEL_BASE: DescricaoDeVariavel = { nome: "base.quantidade", rotulo: "Base › Quantidade da base", tipo: "numero" };

export const VARIAVEIS_DO_PAINEL: DescricaoDeVariavel[] = [
  { nome: "painel.tipo", rotulo: "Painel › Tipo", tipo: "texto" },
  { nome: "painel.tensao", rotulo: "Painel › Tensão", tipo: "numero", unidade: "V" },
  { nome: "painel.equipamentos", rotulo: "Painel › Equipamentos ligados", tipo: "numero" },
];

export const VARIAVEL_FUNCAO_DO_GRUPO: DescricaoDeVariavel = {
  nome: "projeto.funcao_do_grupo",
  rotulo: "Grupo › Código da função de controle",
  tipo: "texto",
};

/**
 * Variáveis que a condição e as fórmulas de uma regra podem usar, conforme
 * o dono e a base. `comuns` vem do servidor (perguntas, atributos, projeto).
 */
export function variaveisDaRegra(comuns: readonly DescricaoDeVariavel[], dono: DonoDaRegra["tipo"], base: BaseDeCalculo): DescricaoDeVariavel[] {
  const lista: DescricaoDeVariavel[] = [VARIAVEL_BASE, ...comuns];
  if (dono === "tipoDePainel" || base === "por_painel") lista.push(...VARIAVEIS_DO_PAINEL);
  if (base === "por_grupo") lista.push(VARIAVEL_FUNCAO_DO_GRUPO);
  const vistos = new Set<string>();
  return lista.filter((v) => (vistos.has(v.nome) ? false : (vistos.add(v.nome), true)));
}
