import { z } from "zod";
import type { ReservaTecnica } from "@zanatta/engine";

export const CODIGOS_DE_RESERVA = ["DI", "DO", "AI", "AO"] as const;

export const reservaSchema: z.ZodType<ReservaTecnica> = z.object({
  modo: z.enum(["nenhuma", "percentual", "fixa"]),
  valores: z.record(z.string().max(20), z.number().finite().min(0, "Use valores a partir de zero.").max(1000, "Valor alto demais.")),
});

export const RESERVA_NENHUMA: ReservaTecnica = { modo: "nenhuma", valores: {} };

export const ROTULO_MODO_RESERVA: Record<ReservaTecnica["modo"], string> = {
  nenhuma: "Sem reserva",
  percentual: "Percentual (%)",
  fixa: "Quantidade fixa",
};
