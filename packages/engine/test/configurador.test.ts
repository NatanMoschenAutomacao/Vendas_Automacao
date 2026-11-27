import { describe, expect, it } from "vitest";
import {
  adicionarEquipamento,
  aplicarKit,
  calcular,
  duplicarInstancia,
  quantidadePorEquipamento,
  removerInstancia,
  responder,
  valorAoEscolherOpcao,
  type ConfiguracaoDoProjeto,
  type EquipamentoNoSnapshot,
  type Pergunta,
  type SnapshotDaBiblioteca,
} from "../src";

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

const estacao: EquipamentoNoSnapshot = {
  id: "est",
  codigo: "ESTACAO",
  nome: "Estação meteorológica",
  ativo: true,
  perguntas: [],
  modelos: [{ id: "est-m", nome: "Estação DEMO", ativo: true, atributos: {}, perguntas: [] }],
};
const sensorChuva: EquipamentoNoSnapshot = {
  id: "chuva",
  codigo: "SENSOR_CHUVA",
  nome: "Sensor de chuva",
  ativo: true,
  perguntas: [
    {
      chave: "local",
      texto: "Local de instalação",
      tipo: "TEXTO_CURTO",
      obrigatoria: false,
      ordem: 0,
      opcoes: [],
      condicao: { tipo: "comparacao", variavel: "projeto.tem(ESTACAO)", operador: "igual", valor: true },
    },
  ],
  modelos: [
    { id: "c1", nome: "Chuva A", ativo: true, atributos: {}, perguntas: [] },
    { id: "c2", nome: "Chuva B", ativo: true, atributos: {}, perguntas: [] },
  ],
};
const inativo: EquipamentoNoSnapshot = { ...sensorChuva, id: "velho", codigo: "VELHO", ativo: false };

const snap: SnapshotDaBiblioteca = { versao: "t", equipamentos: { est: estacao, chuva: sensorChuva, velho: inativo } };
const vazio: ConfiguracaoDoProjeto = { schemaVersion: 1, instancias: [] };

describe("edição da configuração (Fase 04)", () => {
  it("adiciona equipamento escolhendo o modelo quando só há um ativo", () => {
    const g = ids();
    const a = adicionarEquipamento(vazio, snap, "est", g);
    expect(a.instancia).toMatchObject({ equipamentoId: "est", modeloId: "est-m", quantidade: 1, fornecimento: "fornecido" });
    const b = adicionarEquipamento(a.config, snap, "chuva", g);
    expect(b.instancia?.modeloId).toBeNull();
    expect(b.config.instancias).toHaveLength(2);
    expect(vazio.instancias).toHaveLength(0);
  });

  it("não adiciona equipamento inativo", () => {
    const r = adicionarEquipamento(vazio, snap, "velho", ids());
    expect(r.instancia).toBeNull();
    expect(r.config).toBe(vazio);
  });

  it("aplica kit com quantidades e respostas padrão, ignorando itens inativos (estação completa)", () => {
    const r = aplicarKit(
      vazio,
      snap,
      {
        id: "kit",
        nome: "Estação completa",
        itens: [
          { equipamentoId: "est", modeloId: null, quantidade: 1, respostas: {} },
          { equipamentoId: "chuva", modeloId: "c2", quantidade: 2, respostas: { local: "Telhado" } },
          { equipamentoId: "velho", modeloId: null, quantidade: 1, respostas: {} },
        ],
      },
      ids(),
    );
    expect(r.ignorados).toEqual(["velho"]);
    expect(r.adicionadas.map((i) => [i.equipamentoId, i.modeloId, i.quantidade, i.kitId])).toEqual([
      ["est", "est-m", 1, "kit"],
      ["chuva", "c2", 2, "kit"],
    ]);
    expect(quantidadePorEquipamento(r.config)).toEqual({ est: 1, chuva: 2 });
  });

  it("duplica, responde e remove instâncias sem mutar a original", () => {
    const g = ids();
    const { config } = adicionarEquipamento(vazio, snap, "chuva", g);
    const id = config.instancias[0]!.id;
    const respondida = responder(config, id, "local", "Galpão 1");
    const dup = duplicarInstancia(respondida, id, g);
    expect(dup.instancias.map((i) => i.respostas?.local)).toEqual(["Galpão 1", "Galpão 1"]);
    expect(dup.instancias[1]!.id).not.toBe(id);
    expect(removerInstancia(dup, id).instancias).toHaveLength(1);
    expect(config.instancias[0]!.respostas).toEqual({});
  });

  it("alterna opções da seleção múltipla mantendo a ordem cadastrada", () => {
    const p: Pergunta = {
      chave: "x",
      texto: "X",
      tipo: "SELECAO_MULTIPLA",
      obrigatoria: false,
      ordem: 0,
      opcoes: [
        { valor: "a", rotulo: "A" },
        { valor: "b", rotulo: "B" },
      ],
    };
    expect(valorAoEscolherOpcao(p, ["b"], "a")).toEqual(["a", "b"]);
    expect(valorAoEscolherOpcao(p, ["a", "b"], "a")).toEqual(["b"]);
    expect(valorAoEscolherOpcao({ ...p, tipo: "SELECAO_UNICA" }, "a", "b")).toBe("b");
    expect(valorAoEscolherOpcao({ ...p, tipo: "SELECAO_UNICA" }, "b", "b")).toBeNull();
  });

  it("expõe projeto.tem e projeto.quantidade às condições das perguntas", () => {
    const g = ids();
    const soSensor = adicionarEquipamento(vazio, snap, "chuva", g).config;
    const sem = calcular(soSensor, snap);
    const id = soSensor.instancias[0]!.id;
    expect(sem.perguntas[id]!.itens[0]!.visivel).toBe(false);
    const comEstacao = adicionarEquipamento(soSensor, snap, "est", g).config;
    expect(calcular(comEstacao, snap).perguntas[id]!.itens[0]!.visivel).toBe(true);
  });
});
