/**
 * Limite de desconto do vendedor (§35, decisão 12). Função pura, usada pelo
 * servidor ao salvar o rascunho e pela tela para avisar antes.
 */
import Decimal from "decimal.js";
import type { AjusteComercial } from "@zanatta/engine";

const mesmo = (a: AjusteComercial, b: AjusteComercial) =>
  a.tipo === b.tipo && a.escopo === b.escopo && a.modo === b.modo && a.valor === b.valor && a.justificativa === b.justificativa;

/**
 * Verifica os descontos que quem não tem "desconto livre" incluiu ou alterou.
 * Descontos já salvos e não alterados (por exemplo, aplicados pelo
 * administrador) ficam fora da conta. Devolve a mensagem de erro ou null.
 */
export function verificarLimiteDeDesconto(novos: AjusteComercial[], anteriores: AjusteComercial[], limitePercentual: string): string | null {
  const antes = new Map(anteriores.map((a) => [a.id, a]));
  const limite = new Decimal(limitePercentual || "0");
  const porEscopo = new Map<string, Decimal>();
  for (const a of novos) {
    if (a.tipo !== "desconto") continue;
    const anterior = antes.get(a.id);
    if (anterior && mesmo(anterior, a)) continue;
    if (a.modo !== "percentual") return "Desconto em valor só pode ser aplicado pelo administrador técnico.";
    let v: Decimal;
    try {
      v = new Decimal(a.valor);
    } catch {
      return "Valor de desconto inválido.";
    }
    porEscopo.set(a.escopo, (porEscopo.get(a.escopo) ?? new Decimal(0)).plus(v));
  }
  for (const total of porEscopo.values()) {
    if (total.greaterThan(limite)) return `O desconto passa do seu limite de ${limite.toFixed().replace(".", ",")}%. Peça ao administrador técnico.`;
  }
  return null;
}
