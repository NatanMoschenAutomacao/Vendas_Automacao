import { describe, expect, it } from "vitest";
import { calcular, reservaPara, type CartaoNoSnapshot, type ConfiguracaoDoProjeto, type ControladorNoSnapshot, type SnapshotDaBiblioteca } from "../src";

// CLP, cartões e itens DEMO, criados só para os testes (nenhuma capacidade real).
const clp = (c: Partial<ControladorNoSnapshot> = {}): ControladorNoSnapshot => ({
  id: "clp",
  itemId: "i-clp",
  codigo: "CLP-DEMO",
  nome: "CLP DEMO",
  tipo: "clp",
  ativo: true,
  tensoes: [],
  protocolos: [],
  recursos: { do: 4, di: 0 },
  saidas: [],
  modelosCompativeis: [],
  barramento: "B1",
  maxModulos: 4,
  consumoMaxBarramento: null,
  cartoesCompativeis: ["do8", "mix"],
  ...c,
});

const cartao = (id: string, recursos: Record<string, number>, c: Partial<CartaoNoSnapshot> = {}): CartaoNoSnapshot => ({
  id,
  itemId: `i-${id}`,
  codigo: id.toUpperCase(),
  nome: `Cartão ${id} DEMO`,
  ativo: true,
  recursos,
  barramento: "B1",
  consumo: 100,
  ...c,
});

const item = (id: string) => ({ id, codigo: id.slice(2).toUpperCase(), descricao: `Item ${id}`, unidade: "pç", fracionavel: false, ativo: true });

function snap(c: ControladorNoSnapshot, extra: Partial<SnapshotDaBiblioteca> = {}): SnapshotDaBiblioteca {
  return {
    versao: "t",
    equipamentos: { exa: { id: "exa", codigo: "EXA", nome: "Exaustor", ativo: true, perguntas: [], modelos: [{ id: "m1", nome: "M01", ativo: true, atributos: {}, perguntas: [] }] } },
    tiposDeRecurso: {
      do: { id: "do", codigo: "DO", nome: "Saída digital", fisico: true, ativo: true },
      di: { id: "di", codigo: "DI", nome: "Entrada digital", fisico: true, ativo: true },
    },
    itens: Object.fromEntries(["i-clp", "i-do8", "i-mix", "i-do16"].map((i) => [i, item(i)])),
    regras: [
      {
        id: "r",
        codigo: "EXA-IO",
        nome: "IO",
        dono: { tipo: "equipamento", id: "exa" },
        estagio: "recurso",
        base: "por_equipamento",
        condicao: null,
        prioridade: 100,
        permiteRemocao: false,
        ativo: true,
        efeitos: [
          { acao: "recurso", tipoRecursoId: "do", funcao: null, formula: "base.quantidade" },
          { acao: "recurso", tipoRecursoId: "di", funcao: null, formula: "resposta.di" },
        ],
      },
    ],
    controladores: { clp: c },
    cartoes: {
      do8: cartao("do8", { do: 8 }),
      mix: cartao("mix", { di: 4, do: 4 }),
      do16: cartao("do16", { do: 16 }),
    },
    ...extra,
  };
}

/** `do` saídas e `di` entradas ligadas ao CLP. */
function config(saidas: number, entradas: number, extra: Partial<ConfiguracaoDoProjeto> = {}): ConfiguracaoDoProjeto {
  return {
    schemaVersion: 1,
    instancias: [{ id: "x", equipamentoId: "exa", modeloId: "m1", quantidade: saidas, fornecimento: "existente", controladorId: "c1", respostas: {} }],
    controladores: [{ id: "c1", nome: "CLP 1", controladorId: "clp", painelId: null }],
    ...extra,
  };
}

// A regra usa resposta.di, que não é pergunta do equipamento: injeta pelo contexto via quantidade de DI fixa.
const comDI = (s: SnapshotDaBiblioteca, di: number): SnapshotDaBiblioteca => ({
  ...s,
  regras: s.regras!.map((r) => ({ ...r, efeitos: r.efeitos.map((e) => (e.acao === "recurso" && e.tipoRecursoId === "di" ? { ...e, formula: String(di) } : e)) })),
});

const expansao = (r: ReturnType<typeof calcular>) => r.controladores.porControlador[0]!.expansao!;

describe("reserva técnica", () => {
  it("percentual arredonda para cima; fixa soma; nenhuma não reserva", () => {
    expect(reservaPara("DO", 6, { modo: "percentual", valores: { DO: 20 } })).toBe(2);
    expect(reservaPara("DO", 5, { modo: "percentual", valores: { DO: 20 } })).toBe(1);
    expect(reservaPara("DO", 6, { modo: "fixa", valores: { DO: 3 } })).toBe(3);
    expect(reservaPara("DO", 6, { modo: "nenhuma", valores: { DO: 3 } })).toBe(0);
    expect(reservaPara("DI", 6, { modo: "fixa", valores: { DO: 3 } })).toBe(0);
  });
});

describe("expansão por cartões", () => {
  it("cenário 10: déficit = necessidade + reserva − integrado", () => {
    const r = calcular(config(6, 0, { reserva: { modo: "percentual", valores: { DO: 20 } } }), comDI(snap(clp({ cartoesCompativeis: ["mix"] })), 0));
    expect(expansao(r).necessidade).toEqual([{ tipoRecursoId: "do", codigo: "DO", necessario: 6, reserva: 2, integrado: 4, deficit: 4 }]);
    // Uma única combinação válida (MIX) é escolhida sozinha.
    expect(expansao(r).escolhida).toMatchObject({ cartoes: [{ cartaoId: "mix", quantidade: 1 }], modulos: 1 });
    expect(expansao(r).automatica).toBe(true);
    expect(r.materiais.consolidado.find((l) => l.codigo === "MIX")?.quantidade).toBe(1);
  });

  it("a reserva padrão vale quando o projeto não define a sua", () => {
    const r = calcular(config(4, 0), comDI(snap(clp(), { reservaPadrao: { modo: "fixa", valores: { DO: 1 } } }), 0));
    expect(expansao(r).necessidade[0]).toMatchObject({ reserva: 1, deficit: 1 });
  });

  it("cenário 11: várias combinações viram escolha do vendedor; a escolha é gravada", () => {
    // Faltam 6 DO e 2 DI: DO8 + MIX ou 2× MIX, ambas com 2 módulos e 8 pontos de sobra.
    const s = comDI(snap(clp()), 2);
    const r = calcular(config(10, 2), s);
    expect(expansao(r).alternativas.map((a) => a.chave)).toEqual(["do8x1+mixx1", "mixx2"]);
    expect(expansao(r).escolhida).toBeNull();
    expect(r.pendencias.find((p) => p.codigo === "CARTOES_NAO_ESCOLHIDOS")?.gravidade).toBe("impeditiva");
    const escolhido = config(10, 2);
    escolhido.controladores![0]!.cartoes = { mix: 2 };
    const r2 = calcular(escolhido, s);
    expect(expansao(r2).escolhida?.chave).toBe("mixx2");
    expect(r2.materiais.consolidado.find((l) => l.codigo === "MIX")?.quantidade).toBe(2);
    expect(r2.pendencias.some((p) => p.codigo === "CARTOES_NAO_ESCOLHIDOS")).toBe(false);
    // Se a escolha deixar de valer, é descartada com aviso (nunca trocada em silêncio).
    const mudou = calcular({ ...escolhido, instancias: [{ ...escolhido.instancias[0]!, quantidade: 5 }] }, comDI(snap(clp()), 0));
    expect(mudou.pendencias.some((p) => p.codigo === "CARTOES_DESCARTADOS")).toBe(true);
  });

  it("cenário 12: só cartões compatíveis e do mesmo barramento", () => {
    const r = calcular(config(20, 0), comDI(snap(clp({ cartoesCompativeis: ["do8", "do16"] }), { cartoes: { do8: cartao("do8", { do: 8 }), do16: cartao("do16", { do: 16 }, { barramento: "B2" }) } }), 0));
    // DO16 resolveria com 1 módulo, mas é de outro barramento.
    expect(expansao(r).alternativas.map((a) => a.chave)).toEqual(["do8x2"]);
  });

  it("respeita máximo de módulos e consumo do barramento", () => {
    const limitado = calcular(config(20, 0), comDI(snap(clp({ maxModulos: 1 })), 0));
    expect(limitado.controladores.porControlador[0]!.compativel).toBe(false);
    expect(limitado.controladores.porControlador[0]!.motivos).toContain("Nenhuma combinação de cartões cobre o déficit dentro de 1 módulo(s).");
    const consumo = calcular(config(20, 0), comDI(snap(clp({ consumoMaxBarramento: 150 })), 0));
    expect(consumo.controladores.porControlador[0]!.compativel).toBe(false);
  });

  it("sem déficit não há cartões", () => {
    const r = calcular(config(3, 0), comDI(snap(clp()), 0));
    expect(expansao(r)).toMatchObject({ alternativas: [], escolhida: null });
  });
});
