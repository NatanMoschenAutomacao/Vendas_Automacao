import { avaliarCondicao, variaveisDaCondicao } from "../regras/condicao";
import { preenchido, type Contexto, type Valor } from "../regras/contexto";
import { analisarFormula, avaliarFormula, ErroDeFormula, variaveisDaFormula } from "../regras/formula";
import type { Pendencia } from "../types";
import {
  TIPOS_COM_OPCOES,
  TIPOS_NUMERICOS,
  type OpcaoDeResposta,
  type Pergunta,
  type Respostas,
  type ValorDeResposta,
} from "./tipos";

const PREFIXO = "resposta.";

/** Chaves de outras perguntas de que esta depende (condição, opções, fórmula). */
export function dependenciasDaPergunta(p: Pergunta): Set<string> {
  const vars = new Set<string>();
  variaveisDaCondicao(p.condicao, vars);
  for (const o of p.opcoes) variaveisDaCondicao(o.condicao, vars);
  if (p.tipo === "CALCULADO" && p.formula) {
    try {
      variaveisDaFormula(analisarFormula(p.formula), vars);
    } catch {
      // Fórmula inválida é apontada na validação do cadastro.
    }
  }
  const deps = new Set<string>();
  for (const v of vars) if (v.startsWith(PREFIXO)) deps.add(v.slice(PREFIXO.length));
  return deps;
}

/**
 * Procura uma referência circular. Devolve o caminho (["a", "b", "a"]) ou
 * null. Dependências para chaves inexistentes são ignoradas aqui.
 */
export function detectarCiclo(perguntas: readonly Pergunta[]): string[] | null {
  const deps = new Map(perguntas.map((p) => [p.chave, [...dependenciasDaPergunta(p)].sort()]));
  const estado = new Map<string, 1 | 2>();
  const pilha: string[] = [];
  const visitar = (k: string): string[] | null => {
    estado.set(k, 1);
    pilha.push(k);
    for (const d of deps.get(k) ?? []) {
      if (!deps.has(d)) continue;
      if (estado.get(d) === 1) return [...pilha.slice(pilha.indexOf(d)), d];
      if (!estado.has(d)) {
        const c = visitar(d);
        if (c) return c;
      }
    }
    pilha.pop();
    estado.set(k, 2);
    return null;
  };
  for (const p of [...perguntas].sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave))) {
    if (!estado.has(p.chave)) {
      const c = visitar(p.chave);
      if (c) return c;
    }
  }
  return null;
}

/** Ordem de avaliação: dependências antes, respeitando a ordem de exibição. */
export function ordenarPorDependencia(perguntas: readonly Pergunta[]): Pergunta[] {
  const porChave = new Map(perguntas.map((p) => [p.chave, p]));
  const exibicao = [...perguntas].sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave));
  const feito = new Set<string>();
  const emCurso = new Set<string>();
  const saida: Pergunta[] = [];
  const visitar = (p: Pergunta) => {
    if (feito.has(p.chave) || emCurso.has(p.chave)) return;
    emCurso.add(p.chave);
    for (const d of [...dependenciasDaPergunta(p)].sort()) {
      const dp = porChave.get(d);
      if (dp) visitar(dp);
    }
    emCurso.delete(p.chave);
    feito.add(p.chave);
    saida.push(p);
  };
  for (const p of exibicao) visitar(p);
  return saida;
}

export interface ItemAvaliado {
  pergunta: Pergunta;
  visivel: boolean;
  /** Valor que participa dos cálculos (undefined se oculta, vazia ou inválida). */
  valor: ValorDeResposta | undefined;
  opcoes: OpcaoDeResposta[];
  erro?: string;
}

export interface ResultadoDasPerguntas {
  /** Na ordem de exibição. */
  itens: ItemAvaliado[];
  /** resposta.<chave> das perguntas visíveis e válidas. */
  valores: Record<string, ValorDeResposta>;
  pendencias: Pendencia[];
}

/** Valida um valor para a pergunta. Devolve a mensagem de erro ou null. */
export function validarResposta(p: Pergunta, v: unknown, opcoes: readonly OpcaoDeResposta[] = p.opcoes): string | null {
  if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) return null;
  const valores = new Set(opcoes.map((o) => o.valor));
  switch (p.tipo) {
    case "SELECAO_UNICA":
    case "LISTA":
    case "SELECAO_IMAGEM":
      return typeof v === "string" && valores.has(v) ? null : "Opção não disponível.";
    case "SELECAO_MULTIPLA":
      return Array.isArray(v) && v.every((x) => typeof x === "string" && valores.has(x)) ? null : "Opção não disponível.";
    case "SIM_NAO":
      return typeof v === "boolean" ? null : "Responda sim ou não.";
    case "INTEIRO":
    case "DECIMAL":
    case "QUANTIDADE": {
      if (typeof v !== "number" || !Number.isFinite(v)) return "Informe um número.";
      if ((p.tipo === "INTEIRO" || p.tipo === "QUANTIDADE") && !Number.isInteger(v)) return "Informe um número inteiro.";
      if (p.minimo != null && v < p.minimo) return `O mínimo é ${p.minimo}.`;
      if (p.maximo != null && v > p.maximo) return `O máximo é ${p.maximo}.`;
      if (p.passo != null && p.passo > 0) {
        const base = p.minimo ?? 0;
        const k = (v - base) / p.passo;
        if (Math.abs(k - Math.round(k)) > 1e-9) return `Use múltiplos de ${p.passo}.`;
      }
      return null;
    }
    case "TEXTO_CURTO":
      return typeof v === "string" && v.length <= 200 ? null : "Texto de até 200 caracteres.";
    case "TEXTO_LONGO":
      return typeof v === "string" && v.length <= 4000 ? null : "Texto de até 4000 caracteres.";
    case "INFORMACAO":
    case "CALCULADO":
      return null;
  }
}

/**
 * Avalia as perguntas na ordem das dependências. Pergunta oculta mantém a
 * resposta guardada, mas ela não participa de nenhum cálculo. Obrigatoriedade
 * e limites só valem para perguntas visíveis.
 *
 * `contexto` traz modelo.*, instancia.*, projeto.* etc.; `referencia` vai
 * para as pendências (ex.: id da instância).
 */
export function avaliarPerguntas(
  perguntas: readonly Pergunta[],
  respostas: Respostas,
  contexto: Contexto = {},
  referencia?: string,
): ResultadoDasPerguntas {
  const ctx: Record<string, Valor> = { ...contexto };
  const valores: Record<string, ValorDeResposta> = {};
  const pendencias: Pendencia[] = [];
  const porChave = new Map<string, ItemAvaliado>();

  const ciclo = detectarCiclo(perguntas);
  if (ciclo) {
    pendencias.push({
      codigo: "PERGUNTA_CICLO",
      gravidade: "impeditiva",
      mensagem: `Referência circular entre perguntas: ${ciclo.join(" → ")}.`,
      referencia,
    });
  }

  for (const p of ordenarPorDependencia(perguntas)) {
    const visivel = avaliarCondicao(p.condicao, ctx);
    const opcoes = p.opcoes.filter((o) => avaliarCondicao(o.condicao, ctx));
    const item: ItemAvaliado = { pergunta: p, visivel, valor: undefined, opcoes };
    porChave.set(p.chave, item);
    if (!visivel) continue;

    let bruto: unknown;
    if (p.tipo === "INFORMACAO") bruto = p.atributo ? ctx[`modelo.${p.atributo}`] : undefined;
    else if (p.tipo === "CALCULADO") {
      try {
        bruto = p.formula ? avaliarFormula(analisarFormula(p.formula), ctx) : undefined;
      } catch (e) {
        item.erro = e instanceof ErroDeFormula ? e.message : "Erro na fórmula.";
        pendencias.push({
          codigo: "CAMPO_CALCULADO_ERRO",
          gravidade: "advertencia",
          mensagem: `"${p.texto}": ${item.erro}`,
          referencia,
        });
        continue;
      }
    } else bruto = respostas[p.chave] ?? p.padrao ?? undefined;

    if (TIPOS_NUMERICOS.includes(p.tipo) && typeof bruto === "string" && bruto.trim() !== "") bruto = Number(bruto);

    const erro = validarResposta(p, bruto, opcoes);
    if (erro) {
      item.erro = erro;
      pendencias.push({
        codigo: "RESPOSTA_INVALIDA",
        gravidade: "impeditiva",
        mensagem: `"${p.texto}": ${erro}`,
        referencia,
      });
      continue;
    }
    if (!preenchido(bruto as Valor)) {
      if (p.obrigatoria && !(TIPOS_COM_OPCOES.includes(p.tipo) && opcoes.length === 0)) {
        item.erro = "Resposta obrigatória.";
        pendencias.push({
          codigo: "PERGUNTA_OBRIGATORIA",
          gravidade: "impeditiva",
          mensagem: `Responda "${p.texto}".`,
          referencia,
        });
      }
      continue;
    }
    item.valor = bruto as ValorDeResposta;
    valores[p.chave] = item.valor;
    ctx[`resposta.${p.chave}`] = item.valor;
  }

  const itens = [...perguntas]
    .sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave))
    .map((p) => porChave.get(p.chave)!);
  return { itens, valores, pendencias };
}
