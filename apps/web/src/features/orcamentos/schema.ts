import { z } from "zod";

const opcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .transform((v) => (v === "" ? null : v));

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const dadosBasicosSchema = z.object({
  cliente: z.string().trim().min(2, "Informe o cliente.").max(160, "Use no máximo 160 caracteres."),
  empresa: opcional(160),
  projeto: z.string().trim().min(2, "Informe o nome do projeto.").max(160, "Use no máximo 160 caracteres."),
  cidade: opcional(120),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .refine((v) => v === "" || (UFS as readonly string[]).includes(v), "UF inválida.")
    .transform((v) => (v === "" ? null : v)),
  observacoes: opcional(4000),
});

export type DadosBasicos = z.infer<typeof dadosBasicosSchema>;

const valorDeResposta = z
  .union([z.string().max(4000), z.number().finite(), z.boolean(), z.array(z.string().max(200)).max(200)])
  .nullable();

const instanciaSchema = z.object({
  id: z.string().min(1).max(64),
  equipamentoId: z.uuid(),
  modeloId: z.uuid().nullable(),
  quantidade: z.number().finite().min(0).max(100_000),
  fornecimento: z.enum(["fornecido", "existente"]),
  respostas: z.record(z.string().max(64), valorDeResposta).optional(),
  kitId: z.uuid().nullable().optional(),
});

/** Configuração salva no rascunho (entrada do motor). */
export const configuracaoSchema = z.object({
  schemaVersion: z.literal(1),
  instancias: z.array(instanciaSchema).max(500, "O projeto aceita no máximo 500 itens."),
});

export const CONFIGURACAO_VAZIA = { schemaVersion: 1 as const, instancias: [] };

export const ROTULO_STATUS = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_VALIDACAO: "Aguardando validação",
  VALIDADO: "Validado",
  EMITIDO: "Emitido",
} as const;
