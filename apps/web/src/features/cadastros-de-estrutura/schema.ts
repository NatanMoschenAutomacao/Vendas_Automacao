import { z } from "zod";

export const CADASTROS = ["tipo-de-painel", "funcao-de-controle", "tipo-de-recurso"] as const;
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

export const tipoDeRecursoSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Informe o código.")
    .max(20, "Use no máximo 20 caracteres.")
    .regex(/^[A-Z][A-Z0-9_]*$/, "Use letras maiúsculas, números e sublinhado, começando por letra."),
  nome: z.string().trim().min(2, "Informe o nome.").max(80, "Use no máximo 80 caracteres."),
  descricao,
  fisico: z.boolean(),
  isDemo: z.boolean(),
});

/** Designações usuais de I/O; nenhuma capacidade ou dado comercial. */
export const TIPOS_DE_RECURSO_PADRAO = [
  { codigo: "DI", nome: "Entrada digital", fisico: true },
  { codigo: "DO", nome: "Saída digital", fisico: true },
  { codigo: "AI", nome: "Entrada analógica", fisico: true },
  { codigo: "AO", nome: "Saída analógica", fisico: true },
] as const;

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
  "tipo-de-recurso": {
    titulo: "Recursos de automação",
    singular: "tipo de recurso",
    novo: "Novo tipo de recurso",
    caminho: "/admin/recursos",
    descricao: "DI, DO, AI, AO, saídas funcionais (SP) e comunicação. As regras dos equipamentos geram a lista de I/O com estes tipos.",
  },
};
