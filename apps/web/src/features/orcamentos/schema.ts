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
  ambientes: z.array(z.string().min(1).max(64)).max(100).optional(),
  setorId: z.string().min(1).max(64).nullable().optional(),
  painelId: z.string().min(1).max(64).nullable().optional(),
});

const idLocal = z.string().min(1).max(64);
const nome = z.string().max(120);

/** Configuração salva no rascunho (entrada do motor). */
export const configuracaoSchema = z.object({
  schemaVersion: z.literal(1),
  instancias: z.array(instanciaSchema).max(500, "O projeto aceita no máximo 500 itens."),
  ambientes: z.array(z.object({ id: idLocal, nome })).max(200).optional(),
  setores: z.array(z.object({ id: idLocal, ambienteId: idLocal, nome })).max(500).optional(),
  paineis: z
    .array(
      z.object({
        id: idLocal,
        identificacao: nome,
        tipoId: z.uuid().nullable(),
        tensao: z.number().finite().min(0).max(100_000).nullable(),
        ambientes: z.array(idLocal).max(200),
      }),
    )
    .max(100)
    .optional(),
  grupos: z
    .array(
      z.object({
        id: idLocal,
        nome,
        funcaoId: z.uuid().nullable(),
        membros: z.array(z.object({ instanciaId: idLocal, quantidade: z.number().int().min(0).max(100_000) })).max(500),
      }),
    )
    .max(200)
    .optional(),
  ajustes: z
    .array(
      z.object({
        id: idLocal,
        acao: z.enum(["quantidade", "remover", "adicionar"]),
        chave: z.string().max(300).nullable().optional(),
        itemId: z.uuid().nullable().optional(),
        quantidade: z.number().finite().min(0).max(1_000_000).nullable().optional(),
        justificativa: z.string().max(500),
        autor: z.string().max(120).nullable().optional(),
        data: z.string().max(40).nullable().optional(),
      }),
    )
    .max(500)
    .optional(),
});

export const CONFIGURACAO_VAZIA = { schemaVersion: 1 as const, instancias: [] };

export const ROTULO_STATUS = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_VALIDACAO: "Aguardando validação",
  VALIDADO: "Validado",
  EMITIDO: "Emitido",
} as const;
