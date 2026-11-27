import { z } from "zod";
import type { GrupoComercial, Imposto, ModoDePreco, RegraComercial } from "@zanatta/engine";

/**
 * Converte o texto digitado em decimal com ponto: aceita "1.234,56", "1234,56" e "1234.56".
 * Devolve null para vazio e NaN para inválido.
 */
export function normalizarDecimal(v: string): string | null {
  const t = v.trim().replace(/\s|R\$/g, "");
  if (t === "") return null;
  const n = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  return /^\d+(\.\d+)?$/.test(n) ? n : "NaN";
}

/** Valor em dinheiro opcional (≥ 0, até 4 casas). */
export const dinheiroOpcional = (rotulo: string) =>
  z
    .string()
    .transform(normalizarDecimal)
    .refine((v) => v !== "NaN", `${rotulo}: use um número, ex.: 1234,56.`)
    .refine((v) => v === null || (v.split(".")[1]?.length ?? 0) <= 4, `${rotulo}: use no máximo 4 casas decimais.`)
    .refine((v) => v === null || Number(v) < 1e10, `${rotulo}: valor alto demais.`);

export const percentual = (rotulo: string, max = 1000) =>
  z
    .string()
    .transform(normalizarDecimal)
    .refine((v) => v !== null && v !== "NaN", `${rotulo}: informe um percentual, ex.: 12,5.`)
    .transform((v) => v as string)
    .refine((v) => Number(v) <= max, `${rotulo}: no máximo ${max}%.`)
    .refine((v) => (v.split(".")[1]?.length ?? 0) <= 4, `${rotulo}: use no máximo 4 casas decimais.`);

export const ROTULO_MODO: Record<ModoDePreco, string> = {
  venda_fixa: "Venda fixa",
  custo_regra: "Custo + regra comercial",
};

export const MODO_DO_BANCO = { VENDA_FIXA: "venda_fixa", CUSTO_REGRA: "custo_regra" } as const;
export const MODO_PARA_BANCO = { venda_fixa: "VENDA_FIXA", custo_regra: "CUSTO_REGRA" } as const;

export const ROTULO_GRUPO: Record<GrupoComercial, string> = {
  material: "Materiais",
  servico: "Serviços",
  software: "Software",
};

export const precoSchema = z
  .object({
    modo: z.enum(["venda_fixa", "custo_regra"], "Escolha o modo de preço."),
    custo: dinheiroOpcional("Custo"),
    venda: dinheiroOpcional("Venda"),
    vigenteDesde: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a data de início da vigência.")
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), "Data inválida."),
    observacao: z
      .string()
      .trim()
      .max(300, "Use no máximo 300 caracteres.")
      .transform((v) => v || null),
  })
  .superRefine((d, ctx) => {
    if (d.modo === "venda_fixa" && d.venda === null) ctx.addIssue({ code: "custom", path: ["venda"], message: "Venda fixa exige o preço de venda." });
    if (d.modo === "custo_regra" && d.custo === null) ctx.addIssue({ code: "custom", path: ["custo"], message: "Custo + regra exige o custo." });
  });

export const regraComercialSchema: z.ZodType<RegraComercial> = z
  .object({
    tipo: z.enum(["markup", "margem"], "Escolha markup ou margem."),
    percentual: percentual("Percentual"),
  })
  .refine((d) => d.tipo === "markup" || Number(d.percentual) < 100, { message: "A margem precisa ser menor que 100%.", path: ["percentual"] });

export const impostoSchema: z.ZodType<Imposto> = z.object({
  id: z.string().min(1).max(64),
  nome: z.string().trim().min(1, "Informe o nome do imposto.").max(80, "Use no máximo 80 caracteres."),
  grupo: z.enum(["material", "servico", "software"]),
  percentual: percentual("Percentual do imposto", 100),
});

export const limiteSchema = z.object({ percentual: percentual("Limite de desconto", 100) });
export type LimiteDeDesconto = z.infer<typeof limiteSchema>;

export const servicoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Informe o código.")
    .max(40, "Use no máximo 40 caracteres.")
    .regex(/^[A-Z0-9][A-Z0-9._/-]*$/, "Use letras, números, ponto, barra, hífen ou sublinhado."),
  descricao: z.string().trim().min(2, "Informe a descrição.").max(300, "Use no máximo 300 caracteres."),
  unidade: z.string().trim().min(1, "Informe a unidade.").max(10, "Use no máximo 10 caracteres."),
  fracionavel: z.boolean(),
  valor: dinheiroOpcional("Valor de venda"),
  custo: dinheiroOpcional("Custo"),
  isDemo: z.boolean(),
});
