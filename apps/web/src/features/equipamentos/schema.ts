import { z } from "zod";

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres.`)
    .transform((v) => v || null);

export const codigoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(1, "Informe o código.")
  .max(40, "Máximo de 40 caracteres.")
  .regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Use letras, números, ponto, hífen ou sublinhado.");

export const TIPOS_DE_EQUIPAMENTO = ["EQUIPAMENTO", "SENSOR", "ACESSORIO"] as const;
export const ROTULO_TIPO_EQUIPAMENTO: Record<(typeof TIPOS_DE_EQUIPAMENTO)[number], string> = {
  EQUIPAMENTO: "Equipamento",
  SENSOR: "Sensor",
  ACESSORIO: "Acessório",
};

export const equipamentoSchema = z.object({
  codigo: codigoSchema,
  nome: z.string().trim().min(1, "Informe o nome.").max(120, "Máximo de 120 caracteres."),
  descricao: textoOpcional(1000),
  tipo: z.enum(TIPOS_DE_EQUIPAMENTO, "Tipo inválido."),
  categoriaId: z.uuid("Escolha a categoria."),
  isDemo: z.boolean(),
});

export const TIPOS_DE_DADO = ["TEXTO", "NUMERO", "BOOLEANO", "LISTA", "MULTIPLA"] as const;
export const ROTULO_TIPO_DADO: Record<(typeof TIPOS_DE_DADO)[number], string> = {
  TEXTO: "Texto",
  NUMERO: "Número",
  BOOLEANO: "Sim/Não",
  LISTA: "Lista (uma opção)",
  MULTIPLA: "Lista (várias opções)",
};

/** Opções digitadas uma por linha (ou separadas por ponto e vírgula). */
const opcoesSchema = z
  .string()
  .transform((v) => [...new Set(v.split(/[\n;]/).map((x) => x.trim()).filter(Boolean))])
  .pipe(z.array(z.string().max(60, "Cada opção pode ter até 60 caracteres.")).max(50, "Máximo de 50 opções."));

const camposDeDefinicao = {
  rotulo: z.string().trim().min(1, "Informe o nome do campo.").max(60, "Máximo de 60 caracteres."),
  unidade: textoOpcional(20),
  opcoes: opcoesSchema,
  obrigatorio: z.boolean(),
};

function exigirOpcoes<T extends { tipoDado: string; opcoes: string[] }>(d: T, ctx: z.RefinementCtx) {
  if ((d.tipoDado === "LISTA" || d.tipoDado === "MULTIPLA") && d.opcoes.length === 0) {
    ctx.addIssue({ code: "custom", path: ["opcoes"], message: "Informe ao menos uma opção." });
  }
}

export const novaDefinicaoSchema = z
  .object({ ...camposDeDefinicao, tipoDado: z.enum(TIPOS_DE_DADO, "Tipo inválido.") })
  .superRefine(exigirOpcoes);

/** Na edição o tipo de dado não muda: os valores já preenchidos dependem dele. */
export const edicaoDeDefinicaoSchema = z.object(camposDeDefinicao);

export const modeloSchema = z.object({
  codigo: codigoSchema,
  nome: z.string().trim().min(1, "Informe o nome.").max(120, "Máximo de 120 caracteres."),
  fabricante: textoOpcional(80),
  descricao: textoOpcional(1000),
  isDemo: z.boolean(),
});
