import "server-only";
import { db } from "@/server/db";
import { paraPergunta, paraPerguntaDeModelo } from "./conversao";

/** Tudo o que a validação e a pré-visualização precisam de um equipamento. */
export async function carregarPerguntasDoEquipamento(equipamentoId: string) {
  const eq = await db.equipamento.findUniqueOrThrow({
    where: { id: equipamentoId },
    select: {
      id: true,
      nome: true,
      definicoes: { orderBy: { ordem: "asc" }, select: { chave: true, rotulo: true, tipoDado: true, unidade: true, opcoes: true } },
      perguntas: { orderBy: [{ ordem: "asc" }, { chave: "asc" }] },
      modelos: {
        orderBy: [{ ordem: "asc" }, { nome: "asc" }],
        select: {
          id: true,
          nome: true,
          codigo: true,
          ativo: true,
          atributos: true,
          perguntas: { orderBy: [{ ordem: "asc" }, { chave: "asc" }] },
        },
      },
    },
  });
  return {
    ...eq,
    perguntasMotor: eq.perguntas.filter((p) => p.ativo).map(paraPergunta),
    modelosMotor: eq.modelos.map((m) => ({
      id: m.id,
      nome: m.nome,
      codigo: m.codigo,
      ativo: m.ativo,
      atributos: (m.atributos ?? {}) as Record<string, unknown>,
      perguntas: m.perguntas.filter((p) => p.ativo).map(paraPerguntaDeModelo),
    })),
  };
}
