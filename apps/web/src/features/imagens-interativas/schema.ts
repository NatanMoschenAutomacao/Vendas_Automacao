import { z } from "zod";

export const ALVOS = ["EQUIPAMENTO", "MODELO", "KIT", "PERGUNTA", "OPCAO"] as const;
export const ROTULO_ALVO: Record<(typeof ALVOS)[number], string> = {
  EQUIPAMENTO: "Adicionar equipamento",
  MODELO: "Escolher modelo",
  KIT: "Aplicar kit",
  PERGUNTA: "Ir para a pergunta",
  OPCAO: "Marcar opção de resposta",
};

export const imagemInterativaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome.").max(120, "Use no máximo 120 caracteres."),
  /** "categoria:<id>" ou "equipamento:<id>". */
  dono: z.string().regex(/^(categoria|equipamento):[0-9a-f-]{36}$/i, "Escolha onde a imagem aparece."),
  isDemo: z.boolean(),
});

const fracao = z.number().finite().min(0).max(1);

export const hotspotSchema = z
  .object({
    rotulo: z.string().trim().min(1, "Informe o rótulo da área.").max(120),
    forma: z.enum(["RETANGULO", "ELIPSE"]),
    x: fracao,
    y: fracao,
    largura: z.number().finite().min(0.01, "Área muito pequena.").max(1),
    altura: z.number().finite().min(0.01, "Área muito pequena.").max(1),
    alvoTipo: z.enum(ALVOS),
    alvoId: z.string().min(1, "Escolha o alvo da área.").max(64),
    alvoValor: z.string().max(200).nullable(),
  })
  .refine((h) => h.x + h.largura <= 1.0001 && h.y + h.altura <= 1.0001, "A área passa da borda da imagem.");

export const hotspotsSchema = z.array(hotspotSchema).max(200, "No máximo 200 áreas por imagem.");
export type HotspotEditado = z.infer<typeof hotspotSchema>;
