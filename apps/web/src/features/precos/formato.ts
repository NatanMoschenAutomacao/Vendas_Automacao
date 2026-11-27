/** Formatação de dinheiro e percentuais em pt-BR. Recebe os textos decimais do motor. */
const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 4 });

export function dinheiro(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return BRL.format(Number(v));
}

export function numero(v: number | string): string {
  return NUM.format(Number(v));
}

export function pct(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—";
  return `${NUM.format(Number(v))}%`;
}

/** Decimal com ponto para exibir num campo de formulário com vírgula. */
export function paraCampo(v: string | null | undefined): string {
  if (!v) return "";
  const t = v.includes(".") ? v.replace(/0+$/, "").replace(/\.$/, "") : v;
  return t.replace(".", ",");
}

/** Data de hoje (AAAA-MM-DD) no horário de Brasília. */
export function hojeEmBrasilia(agora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(agora);
}

export function dataBR(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" }).format(d);
}
