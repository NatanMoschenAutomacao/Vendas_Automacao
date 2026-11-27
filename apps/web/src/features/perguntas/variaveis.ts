import type { DescricaoDeVariavel, Pergunta, TipoDeVariavel } from "@zanatta/engine";

export interface DefinicaoParaVariavel {
  chave: string;
  rotulo: string;
  tipoDado: string;
  unidade: string | null;
  opcoes: string[];
}

const TIPO_DO_ATRIBUTO: Record<string, TipoDeVariavel> = {
  TEXTO: "texto",
  NUMERO: "numero",
  BOOLEANO: "booleano",
  LISTA: "lista",
  MULTIPLA: "multipla",
};

export function variaveisDoModelo(definicoes: readonly DefinicaoParaVariavel[]): DescricaoDeVariavel[] {
  return definicoes.map((d) => ({
    nome: `modelo.${d.chave}`,
    rotulo: `Modelo › ${d.rotulo}`,
    tipo: TIPO_DO_ATRIBUTO[d.tipoDado] ?? "texto",
    unidade: d.unidade,
    opcoes: d.opcoes.length ? d.opcoes : undefined,
  }));
}

export const VARIAVEIS_DA_INSTANCIA: DescricaoDeVariavel[] = [
  { nome: "instancia.quantidade", rotulo: "Instância › Quantidade", tipo: "numero" },
  { nome: "instancia.fornecimento", rotulo: "Instância › Fornecimento", tipo: "lista", opcoes: ["fornecido", "existente"] },
];

export function variavelDaPergunta(p: Pergunta, definicoes: readonly DefinicaoParaVariavel[]): DescricaoDeVariavel {
  const base = { nome: `resposta.${p.chave}`, rotulo: `Resposta › ${p.texto}`, unidade: p.unidade ?? null };
  switch (p.tipo) {
    case "SELECAO_UNICA":
    case "LISTA":
    case "SELECAO_IMAGEM":
      return { ...base, tipo: "lista", opcoes: p.opcoes.map((o) => o.valor) };
    case "SELECAO_MULTIPLA":
      return { ...base, tipo: "multipla", opcoes: p.opcoes.map((o) => o.valor) };
    case "SIM_NAO":
      return { ...base, tipo: "booleano" };
    case "INTEIRO":
    case "DECIMAL":
    case "QUANTIDADE":
    case "CALCULADO":
      return { ...base, tipo: "numero" };
    case "INFORMACAO": {
      const d = definicoes.find((x) => x.chave === p.atributo);
      return { ...base, tipo: d ? (TIPO_DO_ATRIBUTO[d.tipoDado] ?? "texto") : "texto", opcoes: d?.opcoes.length ? d.opcoes : undefined, unidade: d?.unidade ?? null };
    }
    default:
      return { ...base, tipo: "texto" };
  }
}

export interface EquipamentoParaVariavel {
  codigo: string;
  nome: string;
}

/** projeto.tem("codigo") e projeto.quantidade("codigo") de cada equipamento da biblioteca. */
export function variaveisDoProjeto(equipamentos: readonly EquipamentoParaVariavel[]): DescricaoDeVariavel[] {
  return equipamentos.flatMap((e) => [
    { nome: `projeto.tem(${e.codigo})`, rotulo: `Projeto › Tem ${e.nome}`, tipo: "booleano" as const },
    { nome: `projeto.quantidade(${e.codigo})`, rotulo: `Projeto › Quantidade de ${e.nome}`, tipo: "numero" as const },
  ]);
}

/** Variáveis que uma pergunta pode usar: atributos, instância, projeto e as outras perguntas. */
export function variaveisDisponiveis(
  perguntas: readonly Pergunta[],
  definicoes: readonly DefinicaoParaVariavel[],
  equipamentos: readonly EquipamentoParaVariavel[] = [],
): DescricaoDeVariavel[] {
  return [
    ...perguntas.map((p) => variavelDaPergunta(p, definicoes)),
    ...variaveisDoModelo(definicoes),
    ...VARIAVEIS_DA_INSTANCIA,
    ...variaveisDoProjeto(equipamentos),
  ];
}
