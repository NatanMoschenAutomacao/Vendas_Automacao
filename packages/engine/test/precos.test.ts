import { describe, expect, it } from "vitest";
import {
  calcular,
  equivalencia,
  precoUnitarioDeVenda,
  type ConfiguracaoDoProjeto,
  type RegraNoSnapshot,
  type SnapshotDaBiblioteca,
} from "../src";

// Itens, preços, serviços e impostos DEMO, criados só para os testes. Nenhum valor é real.
const item = (id: string, extra: Record<string, unknown> = {}) => ({ id, codigo: id.toUpperCase(), descricao: `Item ${id}`, unidade: "pç", fracionavel: false, ativo: true, ...extra });

const regra = (r: Partial<RegraNoSnapshot> & Pick<RegraNoSnapshot, "id" | "efeitos">): RegraNoSnapshot => ({
  codigo: r.id.toUpperCase(),
  nome: r.id,
  dono: { tipo: "equipamento", id: "exa" },
  estagio: "material",
  base: "por_equipamento",
  condicao: null,
  prioridade: 100,
  permiteRemocao: false,
  ativo: true,
  ...r,
});

function snap(extra: Partial<SnapshotDaBiblioteca> = {}): SnapshotDaBiblioteca {
  return {
    versao: "t",
    equipamentos: {
      exa: {
        id: "exa",
        codigo: "EXAUSTOR",
        nome: "Exaustor DEMO",
        ativo: true,
        perguntas: [],
        modelos: [{ id: "m1", nome: "Modelo 01", ativo: true, atributos: {}, perguntas: [], itemId: "exaustor" }],
      },
    },
    itens: {
      exaustor: item("exaustor"),
      contator: item("contator"),
      cabo: item("cabo", { unidade: "m", fracionavel: true }),
      licenca: item("licenca", { grupo: "software" }),
    },
    servicos: {
      montagem: { id: "montagem", codigo: "SRV-MONT", descricao: "Montagem DEMO", unidade: "h", fracionavel: true, valor: "120", custo: "70", ativo: true },
    },
    precos: {
      exaustor: { modo: "venda_fixa", custo: "1000", venda: "1500" },
      contator: { modo: "custo_regra", custo: "100", venda: null },
      cabo: { modo: "custo_regra", custo: "3.333", venda: null },
      licenca: { modo: "venda_fixa", custo: null, venda: "800" },
    },
    regraComercial: { tipo: "markup", percentual: "50" },
    regras: [
      regra({ id: "r1", efeitos: [{ acao: "adicionar", itemId: "contator", formula: "base.quantidade", arredondamento: "nenhum" }] }),
      regra({ id: "r2", efeitos: [{ acao: "adicionar", itemId: "cabo", formula: "base.quantidade * 7.5", arredondamento: "nenhum" }] }),
      regra({ id: "s1", estagio: "servico", efeitos: [{ acao: "servico", servicoId: "montagem", formula: "base.quantidade * 1.5", arredondamento: "nenhum" }] }),
    ],
    ...extra,
  };
}

const config = (q: number, extra: Partial<ConfiguracaoDoProjeto> = {}, fornecimento: "fornecido" | "existente" = "fornecido"): ConfiguracaoDoProjeto => ({
  schemaVersion: 1,
  instancias: [{ id: "i1", equipamentoId: "exa", modeloId: "m1", quantidade: q, fornecimento }],
  ...extra,
});

const linha = (r: ReturnType<typeof calcular>, codigo: string) => r.precos.linhas.find((l) => l.codigo === codigo)!;

describe("preços (Fase 09)", () => {
  it("venda fixa usa o preço cadastrado e custo + regra aplica o markup, sem aplicação dupla", () => {
    const r = calcular(config(2), snap());
    expect(linha(r, "EXAUSTOR")).toMatchObject({ modo: "venda_fixa", unitario: "1500.00", total: "3000.00", custoUnitario: "1000.00" });
    expect(linha(r, "CONTATOR")).toMatchObject({ modo: "custo_regra", unitario: "150.00", total: "300.00" });
  });

  it("margem: venda = custo ÷ (1 − margem), e o cadastro mostra a equivalência", () => {
    const r = calcular(config(1), snap({ regraComercial: { tipo: "margem", percentual: "30" } }));
    expect(linha(r, "CONTATOR").unitario).toBe("142.86");
    expect(equivalencia({ tipo: "margem", percentual: "30" })).toBe("42.86");
    expect(equivalencia({ tipo: "markup", percentual: "50" })).toBe("33.33");
    expect(precoUnitarioDeVenda({ modo: "custo_regra", custo: "100", venda: null }, { tipo: "margem", percentual: "100" })).toBeNull();
  });

  it("arredonda por linha e soma as linhas arredondadas (cenário 18)", () => {
    // Cabo: custo 3,333 × 1,5 = 4,9995 → 5,00 por metro; 3 exaustores × 7,5 m = 22,5 m → 112,50.
    const r = calcular(config(3), snap());
    expect(linha(r, "CABO")).toMatchObject({ quantidade: 22.5, unitario: "5.00", total: "112.50" });
    const material = r.precos.grupos.find((g) => g.grupo === "material")!;
    const soma = r.precos.linhas.filter((l) => l.grupo === "material").reduce((s, l) => s + Math.round(Number(l.total) * 100), 0);
    expect(Math.round(Number(material.subtotal) * 100)).toBe(soma);
    expect(material.subtotal).toBe("5062.50"); // 4500 + 450 + 112,50
  });

  it("evita erro de ponto flutuante: 0,1 + 0,2 em linhas vira 0,30 exato", () => {
    const s = snap({
      precos: { exaustor: { modo: "venda_fixa", custo: null, venda: "0.1" }, contator: { modo: "venda_fixa", custo: null, venda: "0.2" } },
      regras: [regra({ id: "r1", efeitos: [{ acao: "adicionar", itemId: "contator", formula: "1", arredondamento: "nenhum" }] })],
    });
    const r = calcular(config(1), s);
    expect(r.precos.total).toBe("0.30");
  });

  it("item sem preço: linha sem preço, total parcial e pendência impeditiva (cenário 15)", () => {
    const s = snap();
    delete s.precos!.contator;
    const r = calcular(config(2), s);
    expect(linha(r, "CONTATOR")).toMatchObject({ semPreco: true, unitario: null, total: null, modo: null });
    expect(r.precos.parcial).toBe(true);
    expect(r.precos.grupos.find((g) => g.grupo === "material")!.parcial).toBe(true);
    expect(r.pendencias.find((p) => p.codigo === "SEM_PRECO")).toMatchObject({ gravidade: "impeditiva", referencia: "contator" });
    // O total parcial soma só o que tem preço.
    expect(r.precos.grupos.find((g) => g.grupo === "material")!.subtotal).toBe("3075.00"); // 3000 + 75 (15 m × 5,00)
  });

  it("custo + regra sem regra comercial configurada vira pendência", () => {
    const r = calcular(config(1), snap({ regraComercial: null }));
    expect(linha(r, "CONTATOR").semPreco).toBe(true);
    expect(r.pendencias.map((p) => p.codigo)).toContain("REGRA_COMERCIAL_AUSENTE");
  });

  it("equipamento existente não cobra fornecimento, mas cobra automação e serviço (cenário 17)", () => {
    const r = calcular(config(2, {}, "existente"), snap());
    expect(r.precos.linhas.map((l) => l.codigo)).toEqual(["CABO", "CONTATOR", "SRV-MONT"]);
    expect(linha(r, "SRV-MONT")).toMatchObject({ quantidade: 3, unitario: "120.00", total: "360.00", grupo: "servico" });
  });

  it("serviços de regras e manuais somam por serviço; software é um grupo próprio", () => {
    const r = calcular(config(1, { servicos: [{ id: "sv1", servicoId: "montagem", quantidade: 2 }] }), snap({ regras: [...snap().regras!, regra({ id: "r3", efeitos: [{ acao: "adicionar", itemId: "licenca", formula: "1", arredondamento: "nenhum" }] })] }));
    expect(linha(r, "SRV-MONT")).toMatchObject({ quantidade: 3.5, total: "420.00" });
    expect(linha(r, "SRV-MONT").chaves).toEqual(["S1#0:i:i1:SRV-MONT", "servico:sv1"]);
    expect(r.precos.grupos.map((g) => [g.grupo, g.subtotal])).toEqual([
      ["material", "1687.50"],
      ["servico", "420.00"],
      ["software", "800.00"],
    ]);
  });

  it("descontos e acréscimos depois da soma, por grupo e no total; impostos por grupo", () => {
    const c = config(2, {
      comercial: {
        ajustes: [
          { id: "d1", tipo: "desconto", escopo: "material", modo: "percentual", valor: "10", justificativa: "Cliente antigo" },
          { id: "a1", tipo: "acrescimo", escopo: "servico", modo: "valor", valor: "40", justificativa: "Deslocamento" },
          { id: "d2", tipo: "desconto", escopo: "total", modo: "valor", valor: "100", justificativa: "Arredondamento comercial" },
        ],
      },
    });
    const s = snap({
      impostos: [
        { id: "t1", nome: "Imposto DEMO material", grupo: "material", percentual: "5" },
        { id: "t2", nome: "Imposto DEMO serviço", grupo: "servico", percentual: "2.5" },
      ],
    });
    const r = calcular(c, s);
    const material = r.precos.grupos.find((g) => g.grupo === "material")!;
    // 3000 + 300 + 75 = 3375; −10% = 3037,50; imposto 5% = 151,88 (151,875 arredondado).
    expect(material).toMatchObject({ subtotal: "3375.00", liquido: "3037.50", total: "3189.38", percentualDeDesconto: "10.00" });
    expect(material.ajustes[0]!.valor).toBe("-337.50");
    expect(material.impostos[0]!.valor).toBe("151.88");
    const servico = r.precos.grupos.find((g) => g.grupo === "servico")!;
    // 3 h × 120 = 360 + 40 = 400; imposto 2,5% = 10.
    expect(servico).toMatchObject({ subtotal: "360.00", liquido: "400.00", total: "410.00" });
    expect(r.precos.subtotal).toBe("3599.38");
    expect(r.precos.total).toBe("3499.38");
    expect(r.precos.ajustesGerais[0]!.valor).toBe("-100.00");
  });

  it("ajuste comercial inválido não é aplicado e desconto maior que o valor vira pendência", () => {
    const r = calcular(
      config(1, {
        comercial: {
          ajustes: [
            { id: "x", tipo: "desconto", escopo: "material", modo: "percentual", valor: "150", justificativa: "?" },
            { id: "y", tipo: "desconto", escopo: "servico", modo: "valor", valor: "9999", justificativa: "teste" },
            { id: "z", tipo: "desconto", escopo: "total", modo: "percentual", valor: "5", justificativa: " " },
          ],
        },
      }),
      snap(),
    );
    expect(r.pendencias.filter((p) => p.codigo === "AJUSTE_COMERCIAL_INVALIDO").map((p) => p.referencia).sort()).toEqual(["x", "z"]);
    expect(r.pendencias.find((p) => p.codigo === "DESCONTO_MAIOR_QUE_O_VALOR")?.referencia).toBe("y");
    expect(r.precos.grupos.find((g) => g.grupo === "servico")!.liquido).toBe("0.00");
  });

  it("custo e margem só aparecem quando o servidor não ocultou os custos", () => {
    const admin = calcular(config(1), snap());
    expect(admin.precos.custoTotal).toBe("1230.00"); // 1000 + 100 + 7,5 × 3,333 (= 25,00) + 1,5 h × 70 (= 105)
    expect(admin.precos.margem).not.toBeNull();
    const vendedor = calcular(config(1), snap({ custosOcultos: true, precos: { exaustor: { modo: "venda_fixa", custo: null, venda: "1500" } } }));
    expect(vendedor.precos.custosOcultos).toBe(true);
    expect(vendedor.precos).not.toHaveProperty("custoTotal");
    expect(vendedor.precos.linhas[0]).not.toHaveProperty("custoUnitario");
  });

  it("serviço manual inativo ou com quantidade inválida vira pendência", () => {
    const s = snap();
    s.servicos!.montagem!.ativo = false;
    const r = calcular(config(1, { servicos: [{ id: "sv", servicoId: "montagem", quantidade: 1 }] }), s);
    expect(r.pendencias.map((p) => p.codigo)).toContain("SERVICO_INDISPONIVEL");
    const r2 = calcular(config(1, { servicos: [{ id: "sv", servicoId: "montagem", quantidade: 0 }] }), snap());
    expect(r2.pendencias.map((p) => p.codigo)).toContain("SERVICO_QUANTIDADE_INVALIDA");
  });

  it("é determinístico (cenário 16)", () => {
    expect(calcular(config(3), snap()).precos).toEqual(calcular(config(3), snap()).precos);
  });
});
