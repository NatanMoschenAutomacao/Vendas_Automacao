import { z } from "zod";
import { SECOES_DO_DESCRITIVO, type BaseDeCalculo, type DonoDaRegra, type SecaoDoDescritivo } from "@zanatta/engine";
import { condicaoSchema } from "@/features/perguntas/schema";

export const ROTULO_SECAO = Object.fromEntries(SECOES_DO_DESCRITIVO.map((s) => [s.id, s.titulo])) as Record<SecaoDoDescritivo, string>;

/** Base usada só para escolher as variáveis da condição de cada dono. */
export const BASE_DO_DONO: Record<DonoDaRegra["tipo"], BaseDeCalculo> = {
  equipamento: "por_equipamento",
  modelo: "por_equipamento",
  tipoDePainel: "por_painel",
  controlador: "por_controlador",
  projeto: "por_projeto",
};

/** Variáveis próprias do texto (além das da condição), por tipo de dono. */
export const VARIAVEIS_DE_TEXTO: Record<DonoDaRegra["tipo"], { nome: string; rotulo: string }[]> = {
  equipamento: [
    { nome: "quantidade", rotulo: "Quantidade da instância" },
    { nome: "equipamento.nome", rotulo: "Nome do equipamento" },
    { nome: "modelo.nome", rotulo: "Nome do modelo" },
    { nome: "ambiente.nome", rotulo: "Ambientes atendidos" },
    { nome: "painel.identificacao", rotulo: "Painel" },
    { nome: "fornecimento", rotulo: "Fornecido ou existente no cliente" },
  ],
  modelo: [],
  tipoDePainel: [
    { nome: "painel.identificacao", rotulo: "Identificação do painel" },
    { nome: "painel.tipo", rotulo: "Tipo do painel" },
    { nome: "painel.tensao", rotulo: "Tensão (V)" },
    { nome: "painel.equipamentos", rotulo: "Equipamentos ligados ao painel" },
    { nome: "ambiente.nome", rotulo: "Ambientes atendidos" },
  ],
  controlador: [
    { nome: "controlador.nome", rotulo: "Nome do controlador no projeto" },
    { nome: "controlador.modelo", rotulo: "Modelo do controlador" },
    { nome: "controlador.codigo", rotulo: "Código do controlador" },
    { nome: "controlador.grupos", rotulo: "Grupos ligados" },
    { nome: "painel.identificacao", rotulo: "Painel" },
  ],
  projeto: [
    { nome: "quantidade", rotulo: "Total de equipamentos" },
    { nome: "ambiente.nome", rotulo: "Ambientes do projeto" },
  ],
};
VARIAVEIS_DE_TEXTO.modelo = VARIAVEIS_DE_TEXTO.equipamento;

export const modeloDeTextoSchema = z.object({
  secao: z.enum(SECOES_DO_DESCRITIVO.map((s) => s.id) as [SecaoDoDescritivo, ...SecaoDoDescritivo[]], "Escolha a seção."),
  texto: z.string().trim().min(2, "Escreva o texto.").max(4000, "Use no máximo 4000 caracteres."),
  condicao: condicaoSchema.nullable(),
  ordem: z.number().int("Use um número inteiro.").min(0, "Mínimo 0.").max(10_000, "Máximo 10000."),
  ativo: z.boolean(),
  isDemo: z.boolean(),
});
export type DadosDoModeloDeTexto = z.infer<typeof modeloDeTextoSchema>;

export const MODELO_DE_TEXTO_VAZIO: DadosDoModeloDeTexto = { secao: "equipamentos", texto: "", condicao: null, ordem: 0, ativo: true, isDemo: false };
