import { z } from "zod";

export const TIPOS = ["CONVENCIONAL", "DIGITAL", "CLP", "IRRIGACAO", "IHM"] as const;
export type TipoDoBanco = (typeof TIPOS)[number];

export const ROTULO_TIPO: Record<TipoDoBanco, string> = {
  CONVENCIONAL: "Convencional",
  DIGITAL: "Digital",
  CLP: "CLP",
  IRRIGACAO: "Irrigação",
  IHM: "IHM",
};

/** Lista separada por vírgula ou ponto e vírgula. */
const lista = (max: number) =>
  z
    .string()
    .max(1000)
    .transform((v) =>
      v
        .split(/[;,]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, max),
    );

/** Campo de formulário que aceita vazio (null) ou inteiro. */
export const inteiroOpcional = (max: number, mensagem: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number().int(mensagem).min(0, mensagem).max(max, mensagem).nullable());

export const controladorSchema = z.object({
  tipo: z.enum(TIPOS, "Escolha o tipo."),
  alimentacao: z
    .string()
    .trim()
    .max(120, "Use no máximo 120 caracteres.")
    .transform((v) => v || null),
  tensoes: lista(10).pipe(
    z.array(z.string().regex(/^\d{1,6}$/, "Informe as tensões em volts, separadas por vírgula (ex.: 24, 220).").transform(Number)),
  ),
  protocolos: lista(20).pipe(z.array(z.string().max(40, "Protocolo com no máximo 40 caracteres."))),
  observacoes: z
    .string()
    .trim()
    .max(2000, "Use no máximo 2000 caracteres.")
    .transform((v) => v || null),
  barramento: z
    .string()
    .trim()
    .max(60, "Use no máximo 60 caracteres.")
    .transform((v) => v || null),
  maxModulos: inteiroOpcional(64, "Máximo de módulos: número inteiro de 0 a 64."),
  consumoMaxBarramento: inteiroOpcional(1_000_000, "Consumo máximo: número inteiro em mA."),
  isDemo: z.boolean(),
});

export const recursosSchema = z.record(z.uuid(), z.number().int("Use números inteiros.").min(0, "Mínimo 0.").max(10_000));

export const saidasSchema = z
  .array(
    z.object({
      id: z.uuid().nullable(),
      codigo: z.string().trim().min(1, "Informe o código da saída.").max(20, "Use no máximo 20 caracteres."),
      descricao: z
        .string()
        .trim()
        .max(200)
        .nullable()
        .transform((v) => v || null),
      funcoes: z.array(z.uuid()).max(50),
    }),
  )
  .max(64, "Use no máximo 64 saídas.");

export type SaidaEditada = z.infer<typeof saidasSchema>[number];
