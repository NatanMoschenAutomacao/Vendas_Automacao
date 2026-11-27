import type { Valor } from "./regras/contexto";
import { resolverPerguntas } from "./perguntas/heranca";
import { avaliarPerguntas, type ResultadoDasPerguntas } from "./perguntas/aplicabilidade";
import { calcularEstrutura, contextoDeEstrutura } from "./estrutura/estrutura";
import { calcularMateriais } from "./materiais/motor";
import { calcularControladores } from "./controladores/controladores";
import { calcularPrecos } from "./precos/precos";
import { calcularDescritivo } from "./descritivo/descritivo";
import type { ResultadoDosControladores } from "./controladores/tipos";
import type { LinhaDeMaterial } from "./materiais/tipos";
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
 * Executa os 8 estágios na ordem definida na arquitetura. Até a Fase 06 têm
 * lógica: perguntas, estrutura, recursos, materiais, ajustes e pendências.
 */
/** Linhas dos cartões escolhidos para cada controlador. */
function linhasDosCartoes(
  config: ConfiguracaoDoProjeto,
  snapshot: SnapshotDaBiblioteca,
  resultado: ResultadoDosControladores,
  pendencias: Pendencia[],
): LinhaDeMaterial[] {
  const linhas: LinhaDeMaterial[] = [];
  for (const a of resultado.porControlador) {
    const cp = config.controladores?.find((c) => c.id === a.id);
    for (const { cartaoId, quantidade } of a.expansao?.escolhida?.cartoes ?? []) {
      const cartao = snapshot.cartoes?.[cartaoId];
      const item = cartao?.itemId ? snapshot.itens?.[cartao.itemId] : undefined;
      if (!item?.ativo) {
        pendencias.push({ codigo: "ITEM_INDISPONIVEL", gravidade: "impeditiva", mensagem: "O item de um cartão de expansão foi removido ou inativado.", referencia: a.id });
        continue;
      }
      linhas.push({
        chave: `cartao:c:${a.id}:${item.codigo}`,
        itemId: item.id,
        codigo: item.codigo,
        descricao: item.descricao,
        unidade: item.unidade,
        quantidade,
        origem: { tipo: "cartao", controladorId: a.id, painelId: cp?.painelId ?? undefined, base: "por_controlador", baseQuantidade: 1 },
      });
    }
  }
  return linhas;
}

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

  const contextos = new Map<string, Record<string, Valor>>();

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
      ...contextoDeEstrutura(inst, config, snapshot),
      "instancia.quantidade": inst.quantidade,
      "instancia.fornecimento": inst.fornecimento,
    };
    for (const [k, v] of Object.entries(modelo?.atributos ?? {})) ctx[`modelo.${k}`] = v as Valor;
    const r = avaliarPerguntas(heranca.perguntas, inst.respostas ?? {}, ctx, inst.id);
    perguntas[inst.id] = r;
    pendencias.push(...r.pendencias);
    const doContexto: Record<string, Valor> = { ...ctx };
    for (const [k, v] of Object.entries(r.valores)) doContexto[`resposta.${k}`] = v;
    contextos.set(inst.id, doContexto);
  }

  // Estágio 2: estrutura (ambientes, setores, painéis, acionamentos, proteções, grupos).
  const { estrutura, pendencias: daEstrutura } = calcularEstrutura(config, snapshot);
  pendencias.push(...daEstrutura);

  // Estágios 3 a 6: recursos; controladores e cartões (entre recursos e materiais); materiais; ajustes.
  let doEstagio4: ReturnType<typeof calcularControladores> | null = null;
  const { materiais, pendencias: dosMateriais } = calcularMateriais(
    config,
    snapshot,
    estrutura,
    contextos,
    { ...doProjeto, "projeto.ambientes": config.ambientes?.length ?? 0 },
    (sinais) => {
      doEstagio4 = calcularControladores(config, snapshot, sinais);
      return linhasDosCartoes(config, snapshot, doEstagio4.controladores, pendencias);
    },
  );
  const { controladores, pendencias: dosControladores } = doEstagio4 ?? calcularControladores(config, snapshot, materiais.sinais);
  pendencias.push(...dosMateriais, ...dosControladores);

  // Estágio 7: preços.
  const { precos, pendencias: dosPrecos } = calcularPrecos(config, snapshot, materiais);
  pendencias.push(...dosPrecos);

  // Estágio 8: descritivo técnico.
  const { descritivo, pendencias: doDescritivo } = calcularDescritivo(config, snapshot, contextos, { ...doProjeto, "projeto.ambientes": config.ambientes?.length ?? 0 });
  pendencias.push(...doDescritivo);

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

  return { pendencias, perguntas, estrutura, materiais, controladores, precos, descritivo, estagios: [...ESTAGIOS] };
}
