import { describe, expect, it } from "vitest";
import {
  adicionarAmbiente,
  adicionarGrupo,
  adicionarPainel,
  adicionarSetor,
  atualizarGrupo,
  atualizarInstancia,
  atualizarPainel,
  calcular,
  definirMembro,
  quantidadeDerivada,
  removerAmbiente,
  removerInstancia,
  removerPainel,
  type ConfiguracaoDoProjeto,
  type SnapshotDaBiblioteca,
} from "../src";

function ids() {
  let n = 0;
  return () => `id${++n}`;
}

// Dados DEMO: regras de acionamento/proteção hipotéticas, só para o teste.
const snap: SnapshotDaBiblioteca = {
  versao: "t",
  equipamentos: {
    exa: {
      id: "exa",
      codigo: "EXAUSTOR",
      nome: "Exaustor DEMO",
      ativo: true,
      perguntas: [],
      acionamento: { tipo: "individual" },
      protecao: { tipo: "coletivo", porGrupo: 4 },
      modelos: [
        { id: "m1", nome: "Modelo 01", ativo: true, atributos: {}, perguntas: [] },
        { id: "m2", nome: "Modelo 02", ativo: true, atributos: {}, perguntas: [], protecao: { tipo: "individual" } },
      ],
    },
    pad: {
      id: "pad",
      codigo: "PAD",
      nome: "Pad & Fan DEMO",
      ativo: true,
      perguntas: [],
      modelos: [{ id: "p1", nome: "Pad 01", ativo: true, atributos: {}, perguntas: [] }],
    },
  },
  tiposDePainel: { tp: { id: "tp", nome: "Controle", ativo: true } },
  funcoes: { temp: { id: "temp", codigo: "temperatura", nome: "Temperatura", ativo: true } },
};

const base: ConfiguracaoDoProjeto = { schemaVersion: 1, instancias: [] };

describe("derivação de acionamentos e proteções", () => {
  it("individual, coletivo e nenhum", () => {
    expect(quantidadeDerivada({ tipo: "individual" }, 5)).toBe(5);
    expect(quantidadeDerivada({ tipo: "coletivo", porGrupo: 4 }, 10)).toBe(3);
    expect(quantidadeDerivada({ tipo: "coletivo" }, 10)).toBe(1);
    expect(quantidadeDerivada({ tipo: "nenhum" }, 10)).toBe(0);
  });
});

describe("estrutura do projeto (Fase 05)", () => {
  it("separa equipamentos, acionamentos, proteções e grupos (cenário 05)", () => {
    const g = ids();
    let c: ConfiguracaoDoProjeto = {
      ...base,
      instancias: [
        { id: "a", equipamentoId: "exa", modeloId: "m1", quantidade: 6, fornecimento: "fornecido" },
        { id: "b", equipamentoId: "exa", modeloId: "m2", quantidade: 4, fornecimento: "existente" },
        { id: "c", equipamentoId: "pad", modeloId: "p1", quantidade: 1, fornecimento: "fornecido" },
      ],
    };
    const g1 = adicionarGrupo(c, "Exaustores", g);
    c = atualizarGrupo(g1.config, g1.grupo.id, { funcaoId: "temp" });
    // Um grupo com modelos diferentes.
    c = definirMembro(c, g1.grupo.id, "a", 6);
    c = definirMembro(c, g1.grupo.id, "b", 4);
    const g2 = adicionarGrupo(c, "Pad & Fan", g);
    c = atualizarGrupo(g2.config, g2.grupo.id, { funcaoId: "temp" });
    c = definirMembro(c, g2.grupo.id, "c", 1);

    const r = calcular(c, snap);
    expect(r.estrutura.totais).toMatchObject({
      equipamentos: 11,
      fornecidos: 7,
      existentes: 4,
      // m1: individual 6; m2: individual 4; pad: nenhum
      acionamentos: 10,
      // m1: coletivo de 4 → 2; m2: individual → 4
      protecoes: 6,
      grupos: 2,
    });
    expect(r.estrutura.grupos).toEqual([
      { grupoId: g1.grupo.id, unidades: 10 },
      { grupoId: g2.grupo.id, unidades: 1 },
    ]);
    expect(r.estrutura.foraDeGrupo).toEqual([]);
    expect(r.pendencias.filter((p) => p.codigo.startsWith("GRUPO"))).toEqual([]);
  });

  it("conta uma vez a instância compartilhada entre ambientes (cenário 09)", () => {
    const g = ids();
    const a1 = adicionarAmbiente(base, "Galpão 1", g);
    const a2 = adicionarAmbiente(a1.config, "Galpão 2", g);
    const c: ConfiguracaoDoProjeto = {
      ...a2.config,
      instancias: [
        { id: "x", equipamentoId: "pad", modeloId: "p1", quantidade: 1, fornecimento: "fornecido", ambientes: [a1.ambiente.id, a2.ambiente.id] },
        { id: "y", equipamentoId: "exa", modeloId: "m1", quantidade: 3, fornecimento: "fornecido", ambientes: [a1.ambiente.id] },
      ],
    };
    const r = calcular(c, snap);
    expect(r.estrutura.totais.equipamentos).toBe(4);
    expect(r.estrutura.totais.compartilhadas).toBe(1);
    expect(r.estrutura.porAmbiente.map((x) => [x.ambienteId, x.quantidade])).toEqual([
      [a1.ambiente.id, 4],
      [a2.ambiente.id, 1],
    ]);
    expect(r.estrutura.porAmbiente[1]!.instancias[0]!.compartilhada).toBe(true);
    expect(r.perguntas.x).toBeDefined();
  });

  it("aponta excesso nos grupos, grupo vazio e sem função", () => {
    const g = ids();
    let c: ConfiguracaoDoProjeto = {
      ...base,
      instancias: [{ id: "a", equipamentoId: "exa", modeloId: "m1", quantidade: 2, fornecimento: "fornecido" }],
    };
    const g1 = adicionarGrupo(c, "G1", g);
    c = definirMembro(g1.config, g1.grupo.id, "a", 3);
    const g2 = adicionarGrupo(c, "G2", g);
    const codigos = calcular(g2.config, snap).pendencias.map((p) => p.codigo);
    expect(codigos).toEqual(expect.arrayContaining(["GRUPO_EXCEDE_QUANTIDADE", "GRUPO_VAZIO", "GRUPO_SEM_FUNCAO"]));
    // Reduzir resolve o excesso e deixa 1 unidade fora de grupo.
    const ok = definirMembro(g2.config, g1.grupo.id, "a", 1);
    const r = calcular(ok, snap);
    expect(r.pendencias.map((p) => p.codigo)).not.toContain("GRUPO_EXCEDE_QUANTIDADE");
    expect(r.estrutura.foraDeGrupo).toEqual([{ instanciaId: "a", quantidade: 1 }]);
  });

  it("setor fora do ambiente, item sem ambiente e sem painel", () => {
    const g = ids();
    const a1 = adicionarAmbiente(base, "Galpão 1", g);
    const a2 = adicionarAmbiente(a1.config, "Galpão 2", g);
    const s = adicionarSetor(a2.config, a2.ambiente.id, "Setor B", g);
    const p = adicionarPainel(s.config, "QC-01", g);
    let c: ConfiguracaoDoProjeto = {
      ...p.config,
      instancias: [
        { id: "a", equipamentoId: "exa", modeloId: "m1", quantidade: 1, fornecimento: "fornecido", ambientes: [a1.ambiente.id], setorId: s.setor.id },
        { id: "b", equipamentoId: "exa", modeloId: "m1", quantidade: 1, fornecimento: "fornecido" },
      ],
    };
    const cod = (cfg: ConfiguracaoDoProjeto) => calcular(cfg, snap).pendencias.map((x) => `${x.codigo}:${x.referencia}`);
    expect(cod(c)).toEqual(
      expect.arrayContaining(["SETOR_FORA_DO_AMBIENTE:a", "ITEM_SEM_AMBIENTE:b", "ITEM_SEM_PAINEL:a", `PAINEL_SEM_TIPO:${p.painel.id}`]),
    );
    c = atualizarPainel(c, p.painel.id, { tipoId: "tp", tensao: 220 });
    c = atualizarInstancia(c, "a", { ambientes: [a2.ambiente.id], painelId: p.painel.id });
    expect(cod(c)).not.toContain("SETOR_FORA_DO_AMBIENTE:a");
    expect(cod(c)).not.toContain(`PAINEL_SEM_TIPO:${p.painel.id}`);
  });

  it("remover ambiente, painel ou item limpa as referências", () => {
    const g = ids();
    const a1 = adicionarAmbiente(base, "Galpão 1", g);
    const s = adicionarSetor(a1.config, a1.ambiente.id, "S1", g);
    const p = adicionarPainel(s.config, "QC", g);
    const gr = adicionarGrupo(p.config, "G", g);
    let c: ConfiguracaoDoProjeto = {
      ...gr.config,
      paineis: [{ ...p.painel, ambientes: [a1.ambiente.id] }],
      instancias: [
        { id: "a", equipamentoId: "exa", modeloId: "m1", quantidade: 1, fornecimento: "fornecido", ambientes: [a1.ambiente.id], setorId: s.setor.id, painelId: p.painel.id },
      ],
    };
    c = definirMembro(c, gr.grupo.id, "a", 1);
    const semAmbiente = removerAmbiente(c, a1.ambiente.id);
    expect(semAmbiente.setores).toEqual([]);
    expect(semAmbiente.instancias[0]).toMatchObject({ ambientes: [], setorId: null });
    expect(semAmbiente.paineis![0]!.ambientes).toEqual([]);
    expect(removerPainel(c, p.painel.id).instancias[0]!.painelId).toBeNull();
    expect(removerInstancia(c, "a").grupos![0]!.membros).toEqual([]);
    expect(calcular(semAmbiente, snap).pendencias.map((x) => x.codigo)).not.toContain("REFERENCIA_INVALIDA");
  });

  it("perguntas enxergam painel.tipo e painel.tensao", () => {
    const c: ConfiguracaoDoProjeto = {
      ...base,
      paineis: [{ id: "p", identificacao: "QC", tipoId: "tp", tensao: 380, ambientes: [] }],
      instancias: [{ id: "a", equipamentoId: "q", modeloId: "q1", quantidade: 1, fornecimento: "fornecido", painelId: "p" }],
    };
    const s: SnapshotDaBiblioteca = {
      ...snap,
      equipamentos: {
        q: {
          id: "q",
          nome: "Q",
          ativo: true,
          modelos: [{ id: "q1", nome: "Q1", ativo: true, atributos: {}, perguntas: [] }],
          perguntas: [
            {
              chave: "obs",
              texto: "Obs",
              tipo: "TEXTO_CURTO",
              obrigatoria: false,
              ordem: 0,
              opcoes: [],
              condicao: { tipo: "comparacao", variavel: "painel.tensao", operador: "igual", valor: 380 },
            },
          ],
        },
      },
    };
    expect(calcular(c, s).perguntas.a!.itens[0]!.visivel).toBe(true);
  });
});
