import { describe, expect, it } from "vitest";
import {
  calcular,
  definirSaidaDoGrupo,
  removerControlador,
  type ConfiguracaoDoProjeto,
  type ControladorNoSnapshot,
  type RegraNoSnapshot,
  type SnapshotDaBiblioteca,
} from "../src";

// Controladores, itens e regras DEMO, criados só para os testes (nenhuma capacidade real).
const TEMP = "temp";
const UMID = "umid";

const controlador = (c: Partial<ControladorNoSnapshot> & Pick<ControladorNoSnapshot, "id">): ControladorNoSnapshot => ({
  itemId: null,
  codigo: c.id.toUpperCase(),
  nome: `Controlador ${c.id} DEMO`,
  tipo: "digital",
  ativo: true,
  tensoes: [],
  protocolos: [],
  recursos: {},
  saidas: [],
  modelosCompativeis: [],
  ...c,
});

const recursoDO: RegraNoSnapshot = {
  id: "r-do",
  codigo: "EXA-DO",
  nome: "DO por exaustor",
  dono: { tipo: "equipamento", id: "exa" },
  estagio: "recurso",
  base: "por_equipamento",
  condicao: null,
  prioridade: 100,
  permiteRemocao: false,
  ativo: true,
  efeitos: [{ acao: "recurso", tipoRecursoId: "do", funcao: "Liga", formula: "base.quantidade" }],
};

function snap(controladores: ControladorNoSnapshot[], regras: RegraNoSnapshot[] = []): SnapshotDaBiblioteca {
  return {
    versao: "t",
    equipamentos: {
      exa: { id: "exa", codigo: "EXAUSTOR", nome: "Exaustor", ativo: true, perguntas: [], modelos: [{ id: "m1", nome: "M01", ativo: true, atributos: {}, perguntas: [] }] },
      pad: { id: "pad", codigo: "PAD", nome: "Pad & Fan", ativo: true, perguntas: [], modelos: [{ id: "p1", nome: "P01", ativo: true, atributos: {}, perguntas: [] }] },
    },
    funcoes: {
      [TEMP]: { id: TEMP, codigo: "temperatura", nome: "Temperatura", ativo: true },
      [UMID]: { id: UMID, codigo: "umidade", nome: "Umidade", ativo: true },
    },
    tiposDeRecurso: { do: { id: "do", codigo: "DO", nome: "Saída digital", fisico: true, ativo: true } },
    itens: {
      ctrl: { id: "ctrl", codigo: "CTRL-DEMO", descricao: "Controlador DEMO", unidade: "pç", fracionavel: false, ativo: true },
      rele: { id: "rele", codigo: "RELE", descricao: "Relé de interface DEMO", unidade: "pç", fracionavel: false, ativo: true },
    },
    regras,
    controladores: Object.fromEntries(controladores.map((c) => [c.id, c])),
  };
}

/** Cenário 06: 10 exaustores e 1 pad & fan em 2 grupos, num controlador. */
function cenario06(controladorId: string | null, distribuicao?: Record<string, string>): ConfiguracaoDoProjeto {
  return {
    schemaVersion: 1,
    instancias: [
      { id: "i-exa", equipamentoId: "exa", modeloId: "m1", quantidade: 10, fornecimento: "fornecido", painelId: "q1" },
      { id: "i-pad", equipamentoId: "pad", modeloId: "p1", quantidade: 1, fornecimento: "fornecido", painelId: "q1" },
    ],
    paineis: [{ id: "q1", identificacao: "QC-01", tipoId: null, tensao: 220, ambientes: [] }],
    grupos: [
      { id: "g-exa", nome: "Exaustores", funcaoId: TEMP, membros: [{ instanciaId: "i-exa", quantidade: 10 }], controladorId: "c1" },
      { id: "g-pad", nome: "Pad & Fan", funcaoId: UMID, membros: [{ instanciaId: "i-pad", quantidade: 1 }], controladorId: "c1" },
    ],
    controladores: [{ id: "c1", nome: "Controlador 1", controladorId, painelId: "q1", distribuicao }],
  };
}

const quatroSaidas = controlador({
  id: "a",
  saidas: [
    { id: "sp1", codigo: "SP1", funcoes: [TEMP, UMID] },
    { id: "sp2", codigo: "SP2", funcoes: [TEMP] },
    { id: "sp3", codigo: "SP3", funcoes: [TEMP] },
    { id: "sp4", codigo: "SP4", funcoes: [TEMP] },
  ],
});

const codigos = (r: ReturnType<typeof calcular>) => r.pendencias.map((p) => p.codigo);

describe("controladores: funções e saídas funcionais", () => {
  it("cenário 06: 11 equipamentos em 2 grupos consomem 2 saídas, não 11", () => {
    const r = calcular(cenario06("a"), snap([quatroSaidas]));
    const a = r.controladores.porControlador[0]!;
    expect(a.compativel).toBe(true);
    expect(a.distribuicao?.filter((d) => d.saidaId)).toHaveLength(2);
    // O emparelhamento realoca: Exaustores (temperatura) não pode ficar com a única saída de umidade.
    expect(a.distribuicao).toEqual([
      { grupoId: "g-exa", saidaId: "sp2", saidaCodigo: "SP2", manual: false },
      { grupoId: "g-pad", saidaId: "sp1", saidaCodigo: "SP1", manual: false },
    ]);
    expect(codigos(r)).not.toContain("CONTROLADOR_INCOMPATIVEL");
  });

  it("ter saídas suficientes não basta: a função precisa ser suportada", () => {
    const soTemperatura = controlador({ id: "b", saidas: [{ id: "s1", codigo: "SP1", funcoes: [TEMP] }, { id: "s2", codigo: "SP2", funcoes: [TEMP] }] });
    const r = calcular(cenario06("b"), snap([soTemperatura, quatroSaidas]));
    const a = r.controladores.porControlador[0]!;
    expect(a.compativel).toBe(false);
    expect(a.motivos?.[0]).toMatch(/Umidade/);
    expect(r.pendencias.find((p) => p.codigo === "CONTROLADOR_INCOMPATIVEL")?.gravidade).toBe("impeditiva");
    // A alternativa compatível aparece primeiro.
    expect(a.alternativas[0]).toMatchObject({ controladorId: "a", compativel: true });
  });

  it("respeita a distribuição do vendedor e descarta a inválida com aviso", () => {
    const ok = calcular(cenario06("a", { "g-exa": "sp3" }), snap([quatroSaidas]));
    expect(ok.controladores.porControlador[0]!.distribuicao?.[0]).toMatchObject({ saidaCodigo: "SP3", manual: true });
    const invalida = calcular(cenario06("a", { "g-pad": "sp2" }), snap([quatroSaidas]));
    expect(codigos(invalida)).toContain("DISTRIBUICAO_DESCARTADA");
    expect(invalida.controladores.porControlador[0]!.distribuicao?.[1]).toMatchObject({ saidaCodigo: "SP1", manual: false });
  });

  it("controlador não escolhido e grupo sem controlador viram pendência", () => {
    const r = calcular(cenario06(null), snap([quatroSaidas]));
    expect(codigos(r)).toContain("CONTROLADOR_NAO_ESCOLHIDO");
    const c = cenario06("a");
    c.grupos![1]!.controladorId = null;
    expect(codigos(calcular(c, snap([quatroSaidas])))).toContain("GRUPO_SEM_CONTROLADOR");
  });
});

describe("controladores: recursos e compatibilidade", () => {
  it("cenário 13: recursos somados por controlador, não pelo projeto", () => {
    const quatroDO = controlador({ id: "d", recursos: { do: 4 } });
    const config: ConfiguracaoDoProjeto = {
      schemaVersion: 1,
      instancias: [
        { id: "x1", equipamentoId: "exa", modeloId: "m1", quantidade: 3, fornecimento: "fornecido", painelId: "q1", controladorId: "c1" },
        { id: "x2", equipamentoId: "exa", modeloId: "m1", quantidade: 3, fornecimento: "fornecido", painelId: "q2", controladorId: "c2" },
      ],
      paineis: [
        { id: "q1", identificacao: "QC-01", tipoId: null, tensao: null, ambientes: [] },
        { id: "q2", identificacao: "QC-02", tipoId: null, tensao: null, ambientes: [] },
      ],
      controladores: [
        { id: "c1", nome: "C1", controladorId: "d", painelId: "q1" },
        { id: "c2", nome: "C2", controladorId: "d", painelId: "q2" },
      ],
    };
    const r = calcular(config, snap([quatroDO], [recursoDO]));
    for (const a of r.controladores.porControlador) {
      expect(a.recursos).toEqual([{ tipoRecursoId: "do", codigo: "DO", necessario: 3, integrado: 4, deficit: 0 }]);
      expect(a.compativel).toBe(true);
    }
    // Tudo num controlador só falta DO.
    config.instancias[1]!.controladorId = "c1";
    const junto = calcular(config, snap([quatroDO], [recursoDO]));
    expect(junto.controladores.porControlador[0]!.motivos).toEqual(["Faltam 2 DO (precisa 6, tem 4)."]);
  });

  it("CLP sem cartões compatíveis e com déficit não é compatível", () => {
    const clp = controlador({ id: "clp", tipo: "clp", recursos: { do: 2 } });
    const c = cenario06("clp");
    c.grupos = [];
    c.instancias[0]!.controladorId = "c1";
    const r = calcular(c, snap([clp], [recursoDO]));
    expect(r.controladores.porControlador[0]!.motivos).toEqual(["Faltam 8 DO (precisa 10, tem 2)."]);
  });

  it("verifica modelos compatíveis e tensão do painel", () => {
    const restrito = controlador({ ...quatroSaidas, id: "r", modelosCompativeis: ["m1"], tensoes: [24] });
    const r = calcular(cenario06("r"), snap([restrito]));
    const motivos = r.controladores.porControlador[0]!.motivos!;
    expect(motivos).toContain("Não é compatível com Pad & Fan P01.");
    expect(motivos).toContain("Não aceita alimentação de 220 V (aceita 24 V).");
    // Sem lista de modelos: aceita, com aviso informativo.
    expect(r.pendencias.some((p) => p.codigo === "COMPATIBILIDADE_NAO_CADASTRADA")).toBe(false);
    const semLista = calcular(cenario06("a"), snap([quatroSaidas]));
    expect(semLista.pendencias.find((p) => p.codigo === "COMPATIBILIDADE_NAO_CADASTRADA")?.gravidade).toBe("informativa");
  });
});

describe("controladores: materiais e edição", () => {
  it("o controlador entra na lista e dispara as regras dele (por controlador)", () => {
    const comItem = controlador({ ...quatroSaidas, id: "a", itemId: "ctrl" });
    const regraDoControlador: RegraNoSnapshot = {
      ...recursoDO,
      id: "r-rele",
      codigo: "RELE-POR-GRUPO",
      dono: { tipo: "controlador", id: "a" },
      estagio: "material",
      base: "por_controlador",
      efeitos: [{ acao: "adicionar", itemId: "rele", formula: "controlador.grupos", arredondamento: "cima" }],
    };
    const r = calcular(cenario06("a"), snap([comItem], [regraDoControlador]));
    const porCodigo = Object.fromEntries(r.materiais.consolidado.map((l) => [l.codigo, l.quantidade]));
    expect(porCodigo).toEqual({ "CTRL-DEMO": 1, RELE: 2 });
    expect(r.materiais.linhas.find((l) => l.codigo === "CTRL-DEMO")?.origem).toMatchObject({ tipo: "controlador", controladorId: "c1" });
  });

  it("remover o controlador solta grupos e itens; a saída escolhida troca de grupo", () => {
    const c = cenario06("a");
    c.instancias[0]!.controladorId = "c1";
    const sem = removerControlador(c, "c1");
    expect(sem.controladores).toEqual([]);
    expect(sem.grupos!.every((g) => g.controladorId === null)).toBe(true);
    expect(sem.instancias[0]!.controladorId).toBeNull();
    const d1 = definirSaidaDoGrupo(c, "c1", "g-exa", "sp1");
    const d2 = definirSaidaDoGrupo(d1, "c1", "g-pad", "sp1");
    expect(d2.controladores![0]!.distribuicao).toEqual({ "g-pad": "sp1" });
  });
});
