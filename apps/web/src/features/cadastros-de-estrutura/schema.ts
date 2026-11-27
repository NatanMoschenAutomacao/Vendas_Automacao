import { z } from "zod";

export const CADASTROS = ["tipo-de-painel", "funcao-de-controle"] as const;
export type Cadastro = (typeof CADASTROS)[number];

const descricao = z
  .string()
  .trim()
  .max(500, "Use no máximo 500 caracteres.")
  .transform((v) => (v === "" ? null : v));

export const tipoDePainelSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(80, "Use no máximo 80 caracteres."),
  descricao,
  isDemo: z.boolean(),
});

export const funcaoDeControleSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Informe o código.")
    .max(40, "Use no máximo 40 caracteres.")
    .regex(/^[a-z][a-z0-9_]*$/, "Use letras minúsculas, números e sublinhado, começando por letra."),
  nome: z.string().trim().min(2, "Informe o nome.").max(80, "Use no máximo 80 caracteres."),
  descricao,
  isDemo: z.boolean(),
});

export const INFO_DO_CADASTRO: Record<Cadastro, { titulo: string; singular: string; novo: string; caminho: string; descricao: string }> = {
  "tipo-de-painel": {
    titulo: "Tipos de painel",
    singular: "tipo de painel",
    novo: "Novo tipo de painel",
    caminho: "/admin/tipos-de-painel",
    descricao: "Monitoramento, controle, ambos ou outros. Na Fase 06 recebem os componentes gerais do painel.",
  },
  "funcao-de-controle": {
    titulo: "Funções de controle",
    singular: "função de controle",
    novo: "Nova função de controle",
    caminho: "/admin/funcoes-de-controle",
    descricao: "Temperatura, umidade, temporização, nível… Usadas pelos grupos de controle e pelas saídas dos controladores.",
  },
};
