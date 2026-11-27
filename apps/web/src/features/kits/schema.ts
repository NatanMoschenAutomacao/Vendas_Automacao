import { z } from "zod";

export const kitSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do kit.").max(120, "Use no máximo 120 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(1000, "Use no máximo 1000 caracteres.")
    .transform((v) => (v === "" ? null : v)),
  categoriaId: z.uuid("Escolha a categoria ou sistema."),
  isDemo: z.boolean(),
});

const valorDeResposta = z
  .union([z.string().max(4000), z.number().finite(), z.boolean(), z.array(z.string().max(200)).max(200)])
  .nullable();

export const itensDoKitSchema = z
  .array(
    z.object({
      equipamentoId: z.uuid("Escolha o equipamento."),
      modeloId: z.uuid().nullable(),
      quantidade: z.number().int("A quantidade deve ser inteira.").min(1, "A quantidade mínima é 1.").max(10_000),
      respostas: z.record(z.string().max(64), valorDeResposta),
    }),
  )
  .max(100, "Um kit aceita no máximo 100 itens.");

export type ItemDoKitEditado = z.infer<typeof itensDoKitSchema>[number];
