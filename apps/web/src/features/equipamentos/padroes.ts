import type { TIPOS_DE_DADO } from "./schema";

/**
 * Campos elétricos sugeridos (§9). São só os CAMPOS: nenhum valor técnico é
 * preenchido automaticamente. A equipe de automação informa os valores de
 * cada modelo.
 */
export const CARACTERISTICAS_ELETRICAS_PADRAO: {
  chave: string;
  rotulo: string;
  tipoDado: (typeof TIPOS_DE_DADO)[number];
  unidade?: string;
  opcoes?: string[];
}[] = [
  { chave: "potencia", rotulo: "Potência", tipoDado: "NUMERO", unidade: "kW" },
  { chave: "corrente", rotulo: "Corrente nominal", tipoDado: "NUMERO", unidade: "A" },
  { chave: "tensao", rotulo: "Tensão", tipoDado: "NUMERO", unidade: "V" },
  { chave: "fases", rotulo: "Fases", tipoDado: "LISTA", opcoes: ["Monofásico", "Bifásico", "Trifásico"] },
  { chave: "frequencia", rotulo: "Frequência", tipoDado: "NUMERO", unidade: "Hz" },
  {
    chave: "comunicacao",
    rotulo: "Comunicação",
    tipoDado: "MULTIPLA",
    opcoes: ["RS485", "Modbus RTU", "4–20 mA", "0–10 V", "Pulso", "Contato digital"],
  },
  { chave: "dimensoes", rotulo: "Dimensões", tipoDado: "TEXTO" },
  { chave: "capacidade", rotulo: "Capacidade", tipoDado: "TEXTO" },
];
