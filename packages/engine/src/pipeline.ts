import type { Valor } from "./regras/contexto";
import { resolverPerguntas } from "./perguntas/heranca";
import { avaliarPerguntas, type ResultadoDasPerguntas } from "./perguntas/aplicabilidade";
import {
  ESTAGIOS,
  type ConfiguracaoDoProjeto,
  type Pendencia,
  type ResultadoDoCalculo,
  type SnapshotDaBiblioteca,
} from "./types";

/**
 * Ponto de entrada do motor. Recalcula tudo do zero a cada chamada:
 * nunca acumula sobre um resultado anterior (cenário 16 do §48).
 *
 * Executa os 8 estágios na ordem definida na arquitetura. Até a Fase 04 têm
 * lógica: perguntas (aplicabilidade por instância) e pendências.
 */
export function calcular(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
): ResultadoDoCalculo {
  const pendencias: Pendencia[] = [];
  const perguntas: Record<string, ResultadoDasPerguntas> = {};

  // Variáveis do projeto: projeto.tem("codigo") e projeto.quantidade("codigo").
  // Todo equipamento da biblioteca entra, para que "não tem" também possa ser testado.
  const doProjeto: Record<string, Valor> = {};
  const porCodigo: Record<string, number> = {};
  for (const eq of Object.values(snapshot.equipamentos ?? {})) {
    if (eq.codigo) porCodigo[eq.codigo] ??= 0;
  }
  for (const inst of config.instancias) {
    const codigo = snapshot.equipamentos?.[inst.equipamentoId]?.codigo;
    if (codigo && Number.isFinite(inst.quantidade) && inst.quantidade > 0) porCodigo[codigo] = (porCodigo[codigo] ?? 0) + inst.quantidade;
  }
  for (const [codigo, qtd] of Object.entries(porCodigo)) {
    doProjeto[`projeto.tem(${codigo})`] = qtd > 0;
    doProjeto[`projeto.quantidade(${codigo})`] = qtd;
  }

  // Estágio 1: perguntas aplicáveis de cada instância.
  for (const inst of config.instancias) {
    if (!snapshot.equipamentos) break;
    const eq = snapshot.equipamentos[inst.equipamentoId];
    if (!eq || !eq.ativo) {
      pendencias.push({
        codigo: "EQUIPAMENTO_INDISPONIVEL",
        gravidade: "impeditiva",
        mensagem: "O equipamento foi removido ou inativado na biblioteca.",
        referencia: inst.id,
      });
      continue;
    }
    const modelo = inst.modeloId ? eq.modelos.find((m) => m.id === inst.modeloId) : undefined;
    if (inst.modeloId && (!modelo || !modelo.ativo)) {
      pendencias.push({
        codigo: "MODELO_INDISPONIVEL",
        gravidade: "impeditiva",
        mensagem: `O modelo escolhido de ${eq.nome} foi removido ou inativado.`,
        referencia: inst.id,
      });
    }
    const heranca = resolverPerguntas(eq.perguntas, modelo?.perguntas ?? []);
    const ctx: Record<string, Valor> = {
      ...doProjeto,
      "instancia.quantidade": inst.quantidade,
      "instancia.fornecimento": inst.fornecimento,
    };
    for (const [k, v] of Object.entries(modelo?.atributos ?? {})) ctx[`modelo.${k}`] = v as Valor;
    const r = avaliarPerguntas(heranca.perguntas, inst.respostas ?? {}, ctx, inst.id);
    perguntas[inst.id] = r;
    pendencias.push(...r.pendencias);
  }

  for (const inst of config.instancias) {
    if (!Number.isInteger(inst.quantidade) || inst.quantidade < 1) {
      pendencias.push({
        codigo: "QUANTIDADE_INVALIDA",
        gravidade: "impeditiva",
        mensagem: "A quantidade deve ser um número inteiro maior que zero.",
        referencia: inst.id,
      });
    }
    if (inst.modeloId === null) {
      pendencias.push({
        codigo: "EQUIPAMENTO_SEM_MODELO",
        gravidade: "impeditiva",
        mensagem: "Selecione o modelo do equipamento.",
        referencia: inst.id,
      });
    }
  }

  pendencias.sort(
    (a, b) =>
      a.codigo.localeCompare(b.codigo) ||
      (a.referencia ?? "").localeCompare(b.referencia ?? "") ||
      a.mensagem.localeCompare(b.mensagem),
  );

  return { pendencias, perguntas, estagios: [...ESTAGIOS] };
}
