/**
 * Dimensionamento de I/O e busca de cartões de expansão (Fase 08).
 *
 * Déficit = necessidade + reserva − integrado (cenário 10). Só entram os
 * cartões listados como compatíveis com o controlador e do mesmo barramento
 * (cenário 12). A busca enumera as quantidades de cada cartão com poda pelo
 * máximo de módulos e pelo consumo do barramento; cartões mistos entram
 * naturalmente. Ficam só as combinações mínimas e não dominadas em
 * módulos e pontos excedentes; várias viram escolha do vendedor (cenário 11).
 */
import type { Id, SnapshotDaBiblioteca } from "../types";
import type {
  CartaoNoSnapshot,
  CombinacaoDeCartoes,
  ControladorNoSnapshot,
  NecessidadeDeExpansao,
  ReservaTecnica,
  ResultadoDaExpansao,
} from "./tipos";

/** Limite de segurança quando o controlador não informa o máximo de módulos. */
export const MODULOS_SEM_LIMITE_CADASTRADO = 8;
/** Limite de combinações avaliadas (proteção contra cadastros enormes). */
const LIMITE_DE_NOS = 200_000;

export function reservaPara(codigo: string, necessario: number, reserva: ReservaTecnica | null | undefined): number {
  if (!reserva || reserva.modo === "nenhuma" || necessario <= 0) return 0;
  const v = reserva.valores[codigo] ?? 0;
  if (!(v > 0)) return 0;
  return reserva.modo === "percentual" ? Math.ceil((necessario * v) / 100 - 1e-9) : Math.ceil(v);
}

export function necessidadeDoControlador(
  c: ControladorNoSnapshot,
  recursos: Record<Id, number>,
  snapshot: SnapshotDaBiblioteca,
  reserva: ReservaTecnica | null | undefined,
): NecessidadeDeExpansao[] {
  return Object.entries(recursos)
    .filter(([, q]) => q > 0)
    .map(([tipoRecursoId, necessario]) => {
      const tipo = snapshot.tiposDeRecurso?.[tipoRecursoId];
      const codigo = tipo?.codigo ?? "?";
      const r = tipo?.fisico === false ? 0 : reservaPara(codigo, necessario, reserva);
      const integrado = c.recursos[tipoRecursoId] ?? 0;
      return { tipoRecursoId, codigo, necessario, reserva: r, integrado, deficit: Math.max(0, necessario + r - integrado) };
    })
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

function chaveDe(cartoes: { cartaoId: Id; quantidade: number }[]) {
  return cartoes
    .filter((c) => c.quantidade > 0)
    .map((c) => `${c.cartaoId}x${c.quantidade}`)
    .sort()
    .join("+");
}

/** Combinações que cobrem o déficit, mínimas e não dominadas. */
export function buscarCombinacoes(
  c: ControladorNoSnapshot,
  deficit: Record<Id, number>,
  cartoes: Record<Id, CartaoNoSnapshot>,
): { alternativas: CombinacaoDeCartoes[]; motivo: string | null; candidatos: CartaoNoSnapshot[] } {
  const faltam = Object.entries(deficit).filter(([, q]) => q > 0);
  if (faltam.length === 0) return { alternativas: [{ chave: "", cartoes: [], modulos: 0, excedente: 0, consumo: 0 }], motivo: null, candidatos: [] };

  const candidatos = (c.cartoesCompativeis ?? [])
    .map((id) => cartoes[id])
    .filter((x): x is CartaoNoSnapshot => !!x?.ativo)
    .filter((x) => !c.barramento || !x.barramento || x.barramento === c.barramento)
    .filter((x) => faltam.some(([t]) => (x.recursos[t] ?? 0) > 0))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
  if (candidatos.length === 0)
    return { alternativas: [], motivo: (c.cartoesCompativeis ?? []).length ? "Nenhum cartão compatível fornece os recursos que faltam." : "O controlador não tem cartões compatíveis cadastrados.", candidatos };

  const maxModulos = c.maxModulos ?? MODULOS_SEM_LIMITE_CADASTRADO;
  const consumoMax = c.consumoMaxBarramento ?? null;
  const validas: CombinacaoDeCartoes[] = [];
  const qtd = new Array<number>(candidatos.length).fill(0);
  let nos = 0;

  const cobre = () => faltam.every(([t, q]) => candidatos.reduce((s, x, i) => s + (x.recursos[t] ?? 0) * qtd[i]!, 0) >= q);
  const visitar = (i: number, modulos: number, consumo: number) => {
    if (++nos > LIMITE_DE_NOS) return;
    if (cobre()) {
      const lista = candidatos.map((x, k) => ({ cartaoId: x.id, quantidade: qtd[k]! })).filter((x) => x.quantidade > 0);
      const fornecido = (t: Id) => candidatos.reduce((s, x, k) => s + (x.recursos[t] ?? 0) * qtd[k]!, 0);
      const tipos = new Set(candidatos.flatMap((x) => Object.keys(x.recursos)));
      const excedente = [...tipos].reduce((s, t) => s + Math.max(0, fornecido(t) - (deficit[t] ?? 0)), 0);
      const semConsumo = candidatos.some((x, k) => qtd[k]! > 0 && x.consumo == null);
      validas.push({ chave: chaveDe(lista), cartoes: lista, modulos, excedente, consumo: semConsumo ? null : consumo });
      return; // Mínima: acrescentar cartões só piora.
    }
    if (i >= candidatos.length || modulos >= maxModulos) return;
    const x = candidatos[i]!;
    for (let n = 0; modulos + n <= maxModulos; n++) {
      const consumoN = consumo + (x.consumo ?? 0) * n;
      if (consumoMax != null && consumoN > consumoMax) break;
      qtd[i] = n;
      visitar(i + 1, modulos + n, consumoN);
    }
    qtd[i] = 0;
  };
  visitar(0, 0, 0);

  const naoDominadas = validas.filter(
    (a) => !validas.some((b) => b !== a && b.modulos <= a.modulos && b.excedente <= a.excedente && (b.modulos < a.modulos || b.excedente < a.excedente)),
  );
  const unicas = [...new Map(naoDominadas.map((x) => [x.chave, x])).values()].sort(
    (a, b) => a.modulos - b.modulos || a.excedente - b.excedente || a.chave.localeCompare(b.chave),
  );
  if (unicas.length === 0) {
    const limite = consumoMax != null ? `${maxModulos} módulo(s) e ${consumoMax} mA de barramento` : `${maxModulos} módulo(s)`;
    return { alternativas: [], motivo: `Nenhuma combinação de cartões cobre o déficit dentro de ${limite}.`, candidatos };
  }
  return { alternativas: unicas, motivo: null, candidatos };
}

/** Necessidade, alternativas e combinação escolhida (validando a escolha do vendedor). */
export function dimensionarExpansao(
  c: ControladorNoSnapshot,
  recursos: Record<Id, number>,
  snapshot: SnapshotDaBiblioteca,
  reserva: ReservaTecnica | null | undefined,
  escolha?: Record<Id, number>,
): ResultadoDaExpansao {
  const necessidade = necessidadeDoControlador(c, recursos, snapshot, reserva);
  const deficit = Object.fromEntries(necessidade.map((n) => [n.tipoRecursoId, n.deficit]));
  const { alternativas, motivo } = buscarCombinacoes(c, deficit, snapshot.cartoes ?? {});
  const semDeficit = necessidade.every((n) => n.deficit === 0);
  if (semDeficit) return { necessidade, alternativas: [], escolhida: null, automatica: false, motivo: null, escolhaDescartada: false };

  let escolhaDescartada = false;
  if (escolha && Object.values(escolha).some((q) => q > 0)) {
    const chave = chaveDe(Object.entries(escolha).map(([cartaoId, quantidade]) => ({ cartaoId, quantidade })));
    const achada = alternativas.find((a) => a.chave === chave);
    if (achada) return { necessidade, alternativas, escolhida: achada, automatica: false, motivo, escolhaDescartada: false };
    escolhaDescartada = true;
  }
  if (alternativas.length === 1) return { necessidade, alternativas, escolhida: alternativas[0]!, automatica: true, motivo, escolhaDescartada };
  return { necessidade, alternativas, escolhida: null, automatica: false, motivo, escolhaDescartada };
}
