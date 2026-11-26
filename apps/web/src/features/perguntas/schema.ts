import { z } from "zod";
import { OPERADORES, TIPOS_DE_PERGUNTA, type Condicao } from "@zanatta/engine";

const valorSimples = z.union([z.string().max(200), z.number().finite(), z.boolean()]);

export const condicaoSchema: z.ZodType<Condicao> = z.lazy(() =>
  z.union([
    z.object({ tipo: z.literal("e"), itens: z.array(condicaoSchema).max(50) }),
    z.object({ tipo: z.literal("ou"), itens: z.array(condicaoSchema).max(50) }),
    z.object({ tipo: z.literal("nao"), item: condicaoSchema }),
    z.object({
      tipo: z.literal("comparacao"),
      variavel: z.string().max(120),
      operador: z.enum(OPERADORES),
      valor: z.union([valorSimples, z.array(valorSimples).max(50)]).optional(),
    }),
  ]),
) as z.ZodType<Condicao>;

export const CHAVE_DE_PERGUNTA = /^[a-z][a-z0-9_]{0,39}$/;

const numeroOpcional = z.number().finite().nullable();

export const perguntaSchema = z.object({
  chave: z
    .string()
    .trim()
    .regex(CHAVE_DE_PERGUNTA, "Use letras minúsculas, números e _ (começando por letra, até 40)."),
  modo: z.enum(["NOVA", "SUBSTITUIR", "OCULTAR"]),
  texto: z.string().trim().min(1, "Informe o texto da pergunta.").max(200, "Máximo de 200 caracteres."),
  ajuda: z.string().trim().max(500).nullable().transform((v) => v || null),
  tipo: z.enum(TIPOS_DE_PERGUNTA, "Tipo inválido."),
  unidade: z.string().trim().max(20).nullable().transform((v) => v || null),
  obrigatoria: z.boolean(),
  minimo: numeroOpcional,
  maximo: numeroOpcional,
  passo: numeroOpcional,
  padrao: z.union([valorSimples, z.array(z.string().max(200))]).nullable(),
  condicao: condicaoSchema.nullable(),
  opcoes: z
    .array(
      z.object({
        valor: z.string().trim().min(1, "Toda opção precisa de valor.").max(60),
        rotulo: z.string().trim().min(1, "Toda opção precisa de rótulo.").max(120),
        imagemUrl: z.string().max(500).nullable().optional(),
        condicao: condicaoSchema.nullable().optional(),
      }),
    )
    .max(60, "Máximo de 60 opções."),
  atributo: z.string().max(40).nullable(),
  formula: z.string().max(500).nullable(),
  ativo: z.boolean(),
});

export type DadosDaPergunta = z.infer<typeof perguntaSchema>;
