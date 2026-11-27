import { z } from "zod";
import { BASES_DE_CALCULO, type Arredondamento, type BaseDeCalculo, type DonoDaRegra } from "@zanatta/engine";
import { condicaoSchema } from "@/features/perguntas/schema";

export const ROTULO_BASE: Record<BaseDeCalculo, string> = {
  por_equipamento: "Por unidade do equipamento",
  por_acionamento: "Por acionamento",
  por_protecao: "Por proteção",
  uma_vez_por_item: "Uma vez por item do orçamento",
  por_painel: "Por painel",
  por_grupo: "Por grupo de controle",
  por_setor: "Por setor",
  por_ambiente: "Por ambiente",
  por_controlador: "Por controlador",
  por_projeto: "Uma vez por projeto",
};

export const ROTULO_ARREDONDAMENTO: Record<Arredondamento, string> = {
  nenhum: "Sem arredondamento",
  cima: "Para cima",
  baixo: "Para baixo",
  proximo: "Mais próximo",
};

export const ROTULO_ACAO = {
  adicionar: "Adicionar item",
  substituir: "Substituir item",
  quantidade: "Alterar quantidade",
  remover: "Remover item",
  recurso: "Gerar recurso de automação",
  servico: "Incluir serviço",
} as const;

export const ROTULO_ESTAGIO = { recurso: "Recurso", material: "Material", servico: "Serviço" } as const;
export const ESTAGIO_PARA_BANCO = { recurso: "RECURSO", material: "MATERIAL", servico: "SERVICO" } as const;
export const ESTAGIO_DO_BANCO = { RECURSO: "recurso", MATERIAL: "material", SERVICO: "servico" } as const;

export const ROTULO_DONO: Record<DonoDaRegra["tipo"], string> = {
  equipamento: "Equipamento",
  modelo: "Modelo",
  tipoDePainel: "Tipo de painel",
  controlador: "Controlador",
  projeto: "Projeto",
};

const formula = z.string().trim().min(1, "Informe a fórmula.").max(500, "Use no máximo 500 caracteres.");
const arredondamento = z.enum(["nenhum", "cima", "baixo", "proximo"]);
const id = z.uuid("Escolha o item.");

export const efeitoSchema = z.discriminatedUnion("acao", [
  z.object({ acao: z.literal("adicionar"), itemId: id, formula, arredondamento }),
  z.object({ acao: z.literal("substituir"), itemId: id, substitutoId: z.uuid("Escolha o substituto.") }),
  z.object({ acao: z.literal("quantidade"), itemId: id, formula, arredondamento }),
  z.object({ acao: z.literal("remover"), itemId: id }),
  z.object({
    acao: z.literal("recurso"),
    tipoRecursoId: z.uuid("Escolha o tipo de recurso."),
    funcao: z
      .string()
      .trim()
      .max(80, "Use no máximo 80 caracteres.")
      .nullable()
      .transform((v) => (v ? v : null)),
    formula,
  }),
  z.object({ acao: z.literal("servico"), servicoId: z.uuid("Escolha o serviço."), formula, arredondamento }),
]);

export const regraSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, "Informe o código.")
    .max(40, "Use no máximo 40 caracteres.")
    .regex(/^[A-Z0-9][A-Z0-9._-]*$/, "Use letras, números, ponto, hífen ou sublinhado."),
  nome: z.string().trim().min(2, "Informe o nome.").max(120, "Use no máximo 120 caracteres."),
  descricao: z
    .string()
    .trim()
    .max(1000, "Use no máximo 1000 caracteres.")
    .nullable()
    .transform((v) => (v ? v : null)),
  estagio: z.enum(["recurso", "material", "servico"]),
  base: z.enum(BASES_DE_CALCULO),
  condicao: condicaoSchema.nullable(),
  prioridade: z.number().int("Use um número inteiro.").min(0, "Mínimo 0.").max(10_000, "Máximo 10000."),
  permiteRemocao: z.boolean(),
  ativo: z.boolean(),
  isDemo: z.boolean(),
  efeitos: z.array(efeitoSchema).min(1, "Adicione pelo menos um efeito.").max(50, "Use no máximo 50 efeitos."),
});

export type DadosDaRegra = z.infer<typeof regraSchema>;
export type EfeitoEditado = DadosDaRegra["efeitos"][number];

export const REGRA_VAZIA: DadosDaRegra = {
  codigo: "",
  nome: "",
  descricao: null,
  estagio: "material",
  base: "por_equipamento",
  condicao: null,
  prioridade: 100,
  permiteRemocao: false,
  ativo: true,
  isDemo: false,
  efeitos: [],
};
