import { z } from "zod";

export const categoriaSchema = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(80, "Máximo de 80 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(300, "Máximo de 300 caracteres.")
    .transform((v) => v || null),
  paiId: z
    .string()
    .transform((v) => v || null)
    .pipe(z.uuid("Categoria pai inválida.").nullable()),
});
