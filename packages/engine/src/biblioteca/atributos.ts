/**
 * Características técnicas (§9): o equipamento define os campos e cada modelo
 * preenche os valores. Funções puras, sem I/O.
 */
export type TipoDeDado = "TEXTO" | "NUMERO" | "BOOLEANO" | "LISTA" | "MULTIPLA";

export interface DefinicaoDeAtributo {
  chave: string;
  rotulo: string;
  tipoDado: TipoDeDado;
  unidade?: string | null;
  opcoes: string[];
  obrigatorio: boolean;
}

export type ValorDeAtributo = string | number | boolean | string[];
export type ValoresDeAtributos = Record<string, ValorDeAtributo>;

/** Entrada bruta, como vem de um formulário: texto ou lista de textos. */
export type EntradaDeAtributos = Record<string, string | string[] | undefined>;

export interface ResultadoDaValidacao {
  valores: ValoresDeAtributos;
  erros: Record<string, string>;
}

const CHAVE_VALIDA = /^[a-z][a-z0-9_]{0,39}$/;

/** Gera uma chave estável a partir do rótulo: "Potência (kW)" → "potencia_kw". */
export function chaveDoRotulo(rotulo: string): string {
  const base = rotulo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const chave = /^[a-z]/.test(base) ? base : `c_${base}`.slice(0, 40);
  return chave.replace(/_+$/g, "") || "campo";
}

export function chaveValida(chave: string): boolean {
  return CHAVE_VALIDA.test(chave);
}

/** Aceita "1,5", "1.5" e "1.234,5". Retorna null se não for número finito. */
export function lerNumero(texto: string): number | null {
  let t = texto.trim().replace(/\s/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function primeiro(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).trim();
}

/**
 * Converte a entrada bruta em valores tipados e aponta erros por chave.
 * Campos vazios e não obrigatórios ficam fora de `valores`.
 * Chaves que não têm definição são descartadas.
 */
export function validarAtributos(
  definicoes: readonly DefinicaoDeAtributo[],
  entrada: EntradaDeAtributos,
): ResultadoDaValidacao {
  const valores: ValoresDeAtributos = {};
  const erros: Record<string, string> = {};

  for (const d of definicoes) {
    const bruto = entrada[d.chave];
    switch (d.tipoDado) {
      case "TEXTO": {
        const t = primeiro(bruto);
        if (t) valores[d.chave] = t;
        else if (d.obrigatorio) erros[d.chave] = "Campo obrigatório.";
        break;
      }
      case "NUMERO": {
        const t = primeiro(bruto);
        if (!t) {
          if (d.obrigatorio) erros[d.chave] = "Campo obrigatório.";
          break;
        }
        const n = lerNumero(t);
        if (n === null) erros[d.chave] = "Informe um número.";
        else valores[d.chave] = n;
        break;
      }
      case "BOOLEANO": {
        const t = primeiro(bruto);
        if (t === "sim" || t === "true" || t === "on") valores[d.chave] = true;
        else if (t === "nao" || t === "false") valores[d.chave] = false;
        else if (t) erros[d.chave] = "Valor inválido.";
        else if (d.obrigatorio) erros[d.chave] = "Campo obrigatório.";
        break;
      }
      case "LISTA": {
        const t = primeiro(bruto);
        if (!t) {
          if (d.obrigatorio) erros[d.chave] = "Escolha uma opção.";
        } else if (!d.opcoes.includes(t)) erros[d.chave] = "Opção inválida.";
        else valores[d.chave] = t;
        break;
      }
      case "MULTIPLA": {
        const lista = (Array.isArray(bruto) ? bruto : bruto ? [bruto] : []).map((x) => x.trim()).filter(Boolean);
        const invalidas = lista.filter((x) => !d.opcoes.includes(x));
        if (invalidas.length) erros[d.chave] = "Opção inválida.";
        else if (lista.length) valores[d.chave] = d.opcoes.filter((o) => lista.includes(o));
        else if (d.obrigatorio) erros[d.chave] = "Escolha ao menos uma opção.";
        break;
      }
    }
  }
  return { valores, erros };
}

/** Lista as características obrigatórias sem valor (para pendências e avisos). */
export function atributosFaltantes(
  definicoes: readonly DefinicaoDeAtributo[],
  valores: Record<string, unknown>,
): string[] {
  return definicoes
    .filter((d) => {
      if (!d.obrigatorio) return false;
      const v = valores[d.chave];
      return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    })
    .map((d) => d.chave);
}

/** Texto para exibir um valor: "7,5 kW", "Sim", "RS485, Modbus RTU". */
export function formatarAtributo(d: DefinicaoDeAtributo, v: unknown): string {
  if (v === undefined || v === null || v === "") return "";
  let t: string;
  if (typeof v === "boolean") t = v ? "Sim" : "Não";
  else if (typeof v === "number") t = v.toLocaleString("pt-BR", { maximumFractionDigits: 6 });
  else if (Array.isArray(v)) t = v.join(", ");
  else t = String(v);
  return d.unidade && typeof v === "number" ? `${t} ${d.unidade}` : t;
}
