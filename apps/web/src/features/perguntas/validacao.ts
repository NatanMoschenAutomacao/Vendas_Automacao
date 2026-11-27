import {
  analisarFormula,
  detectarCiclo,
  ErroDeFormula,
  resolverPerguntas,
  TIPOS_COM_OPCOES,
  TIPOS_NUMERICOS,
  validarCondicao,
  validarResposta,
  variaveisDaFormula,
  type Pergunta,
  type PerguntaDeModelo,
} from "@zanatta/engine";
import type { DadosDaPergunta } from "./schema";
import { variaveisDisponiveis, type DefinicaoParaVariavel, type EquipamentoParaVariavel } from "./variaveis";

export interface ContextoDeValidacao {
  dono: "equipamento" | "modelo";
  /** Perguntas do equipamento (sem a que está sendo editada, se for do equipamento). */
  doEquipamento: Pergunta[];
  /** Perguntas de cada modelo (sem a que está sendo editada, se for de modelo). */
  porModelo: Map<string, PerguntaDeModelo[]>;
  /** Modelo dono, quando dono = "modelo". */
  modeloId?: string;
  definicoes: DefinicaoParaVariavel[];
  /** Equipamentos da biblioteca, para projeto.tem(...) e projeto.quantidade(...). */
  equipamentos?: EquipamentoParaVariavel[];
}

/** Monta a pergunta do motor a partir dos dados do formulário. */
export function paraMotor(d: DadosDaPergunta, ordem: number): PerguntaDeModelo {
  return {
    chave: d.chave,
    modo: d.modo,
    texto: d.texto,
    ajuda: d.ajuda,
    tipo: d.tipo,
    unidade: d.unidade,
    obrigatoria: d.obrigatoria,
    minimo: d.minimo,
    maximo: d.maximo,
    passo: d.passo,
    padrao: d.padrao,
    ordem,
    condicao: d.condicao,
    opcoes: d.opcoes.map((o) => ({ valor: o.valor, rotulo: o.rotulo, imagemUrl: o.imagemUrl ?? null, condicao: o.condicao ?? null })),
    atributo: d.atributo,
    formula: d.formula,
  };
}

/**
 * Regras de cadastro de pergunta. Devolve erros por campo ("geral" para os
 * que envolvem o conjunto, como referência circular).
 */
export function validarPergunta(d: DadosDaPergunta, ordem: number, ctx: ContextoDeValidacao): Record<string, string> {
  const erros: Record<string, string> = {};
  const nova = paraMotor(d, ordem);
  const chavesDoEquipamento = new Set(ctx.doEquipamento.map((p) => p.chave));

  // Chave única e modo de herança.
  if (ctx.dono === "equipamento") {
    if (d.modo !== "NOVA") erros.modo = "Perguntas do equipamento não usam herança.";
    if (chavesDoEquipamento.has(d.chave)) erros.chave = "Já existe uma pergunta com essa chave neste equipamento.";
    for (const [, lista] of ctx.porModelo) {
      const conflito = lista.find((p) => p.chave === d.chave && p.modo === "NOVA");
      if (conflito) erros.chave = "Um modelo já usa essa chave como pergunta própria. Mude a chave ou ajuste o modelo.";
    }
  } else {
    const doModelo = ctx.porModelo.get(ctx.modeloId ?? "") ?? [];
    if (doModelo.some((p) => p.chave === d.chave)) erros.chave = "Já existe uma pergunta com essa chave neste modelo.";
    else if (chavesDoEquipamento.has(d.chave) && d.modo === "NOVA")
      erros.modo = "O equipamento já tem essa chave: escolha Substituir ou Ocultar.";
    else if (!chavesDoEquipamento.has(d.chave) && d.modo !== "NOVA")
      erros.modo = "O equipamento não tem pergunta com essa chave para substituir ou ocultar.";
  }
  if (d.modo === "OCULTAR") return erros;

  // Campos por tipo.
  if (TIPOS_COM_OPCOES.includes(d.tipo)) {
    if (d.opcoes.length === 0) erros.opcoes = "Cadastre ao menos uma opção.";
    const valores = d.opcoes.map((o) => o.valor);
    if (new Set(valores).size !== valores.length) erros.opcoes = "Os valores das opções devem ser diferentes.";
  }
  if (TIPOS_NUMERICOS.includes(d.tipo)) {
    if (d.minimo != null && d.maximo != null && d.minimo > d.maximo) erros.maximo = "O máximo deve ser maior ou igual ao mínimo.";
    if (d.passo != null && d.passo <= 0) erros.passo = "O passo deve ser maior que zero.";
  }
  if (d.tipo === "INFORMACAO" && !ctx.definicoes.some((x) => x.chave === d.atributo))
    erros.atributo = "Escolha uma característica do equipamento.";

  // Conjunto efetivo para checar variáveis e ciclos.
  const outras = ctx.dono === "equipamento" ? ctx.doEquipamento : resolverPerguntas(ctx.doEquipamento, ctx.porModelo.get(ctx.modeloId ?? "") ?? []).perguntas;
  const variaveis = variaveisDisponiveis(outras.filter((p) => p.chave !== d.chave), ctx.definicoes, ctx.equipamentos);
  const nomes = new Set(variaveis.map((v) => v.nome));

  if (d.tipo === "CALCULADO") {
    if (!d.formula?.trim()) erros.formula = "Informe a fórmula.";
    else {
      try {
        const vars = variaveisDaFormula(analisarFormula(d.formula));
        const faltando = [...vars].filter((v) => !nomes.has(v));
        if (faltando.length) erros.formula = `Variável inexistente: ${faltando.join(", ")}.`;
      } catch (e) {
        erros.formula = e instanceof ErroDeFormula ? e.message : "Fórmula inválida.";
      }
    }
  }

  if (d.padrao !== null && !["INFORMACAO", "CALCULADO"].includes(d.tipo)) {
    const erro = validarResposta(nova, d.padrao);
    if (erro) erros.padrao = `Padrão inválido: ${erro}`;
  }

  const errosCondicao = d.condicao ? validarCondicao(d.condicao, variaveis) : [];
  if (errosCondicao.length) erros.condicao = errosCondicao.join(" ");
  for (const o of d.opcoes) {
    const e = o.condicao ? validarCondicao(o.condicao, variaveis) : [];
    if (e.length) erros.opcoes = `Opção "${o.rotulo}": ${e.join(" ")}`;
  }
  if (Object.keys(erros).length) return erros;

  // Referência circular: no equipamento e em cada modelo.
  const conjuntos: Pergunta[][] = [];
  if (ctx.dono === "equipamento") {
    const eq = [...ctx.doEquipamento, nova];
    conjuntos.push(eq);
    for (const [, lista] of ctx.porModelo) conjuntos.push(resolverPerguntas(eq, lista).perguntas);
  } else {
    const lista = [...(ctx.porModelo.get(ctx.modeloId ?? "") ?? []), nova];
    conjuntos.push(resolverPerguntas(ctx.doEquipamento, lista).perguntas);
  }
  for (const c of conjuntos) {
    const ciclo = detectarCiclo(c);
    if (ciclo) {
      erros.geral = `Referência circular: ${ciclo.join(" depende de ")}.`;
      break;
    }
  }
  return erros;
}
