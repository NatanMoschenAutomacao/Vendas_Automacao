import { z } from "zod";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

export const codigoDeItemSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Informe o código.")
  .max(40, "Use no máximo 40 caracteres.")
  .regex(/^[A-Z0-9][A-Z0-9._/-]*$/, "Use letras, números, ponto, barra, hífen ou sublinhado.");

export const itemSchema = z.object({
  codigo: codigoDeItemSchema,
  descricao: z.string().trim().min(2, "Informe a descrição.").max(300, "Use no máximo 300 caracteres."),
  unidade: z.string().trim().min(1, "Informe a unidade.").max(10, "Use no máximo 10 caracteres."),
  fracionavel: z.boolean(),
  codigoFabricante: opcional(80),
  fabricante: opcional(120),
  modelo: opcional(120),
  fornecedor: opcional(120),
  categoriaId: z
    .string()
    .transform((v) => (v === "" ? null : v))
    .pipe(z.uuid("Categoria inválida.").nullable()),
  isDemo: z.boolean(),
});

export type DadosDoItem = z.infer<typeof itemSchema>;
