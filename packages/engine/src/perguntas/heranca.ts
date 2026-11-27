import type { Pergunta, PerguntaDeModelo } from "./tipos";

export interface ResultadoDaHeranca {
  perguntas: (Pergunta & { origem: "equipamento" | "modelo" })[];
  erros: string[];
}

/**
 * Perguntas efetivas de uma instância: as do equipamento somadas às do
 * modelo escolhido. No modelo, a mesma chave pode SUBSTITUIR (vale a versão
 * do modelo) ou OCULTAR (a pergunta some). Chave nova é exclusiva do modelo.
 * Chave repetida com modo NOVA, ou SUBSTITUIR/OCULTAR sem chave no
 * equipamento, é erro de cadastro.
 */
export function resolverPerguntas(
  doEquipamento: readonly Pergunta[],
  doModelo: readonly PerguntaDeModelo[] = [],
): ResultadoDaHeranca {
  const erros: string[] = [];
  const base = new Map(doEquipamento.map((p) => [p.chave, p]));
  const substituicoes = new Map<string, Pergunta>();
  const ocultas = new Set<string>();
  const novas: Pergunta[] = [];

  for (const m of doModelo) {
    const existe = base.has(m.chave);
    if (m.modo === "NOVA") {
      if (existe) erros.push(`A pergunta "${m.chave}" já existe no equipamento: use Substituir ou Ocultar.`);
      else novas.push(m);
    } else if (!existe) {
      erros.push(`"${m.chave}" está como ${m.modo === "SUBSTITUIR" ? "Substituir" : "Ocultar"}, mas o equipamento não tem essa pergunta.`);
    } else if (m.modo === "SUBSTITUIR") substituicoes.set(m.chave, m);
    else ocultas.add(m.chave);
  }

  const perguntas: ResultadoDaHeranca["perguntas"] = [];
  for (const p of doEquipamento) {
    if (ocultas.has(p.chave)) continue;
    const s = substituicoes.get(p.chave);
    perguntas.push(s ? { ...stripModo(s), origem: "modelo" } : { ...p, origem: "equipamento" });
  }
  for (const n of novas) perguntas.push({ ...stripModo(n), origem: "modelo" });
  perguntas.sort((a, b) => a.ordem - b.ordem || a.chave.localeCompare(b.chave));
  return { perguntas, erros };
}

function stripModo(p: Pergunta): Pergunta {
  const { modo: _modo, ...resto } = p as PerguntaDeModelo;
  void _modo;
  return resto;
}
