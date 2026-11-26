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
 * Fase 01: executa os 8 estágios na ordem definida na arquitetura.
 * Só o estágio de pendências tem lógica (validação básica das instâncias);
 * os demais são preenchidos nas fases seguintes.
 */
export function calcular(
  config: ConfiguracaoDoProjeto,
  _snapshot: SnapshotDaBiblioteca,
): ResultadoDoCalculo {
  const pendencias: Pendencia[] = [];

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

  pendencias.sort((a, b) =>
    a.codigo === b.codigo
      ? (a.referencia ?? "").localeCompare(b.referencia ?? "")
      : a.codigo.localeCompare(b.codigo),
  );

  return { pendencias, estagios: [...ESTAGIOS] };
}
