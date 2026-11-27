import { describe, expect, it } from "vitest";
import { calcular, editarTrechoDoDescritivo, preencherTexto, type ConfiguracaoDoProjeto, type ModeloDeTextoNoSnapshot, type SnapshotDaBiblioteca } from "../src";

// Modelos de texto DEMO, só para os testes.
const texto = (m: Partial<ModeloDeTextoNoSnapshot> & Pick<ModeloDeTextoNoSnapshot, "id" | "texto" | "dono">): ModeloDeTextoNoSnapshot => ({
  secao: "equipamentos",
  condicao: null,
  ordem: 0,
  ativo: true,
  ...m,
});

function snap(modelos: ModeloDeTextoNoSnapshot[]): SnapshotDaBiblioteca {
  return {
    versao: "t",
    equipamentos: {
      exa: {
        id: "exa",
        codigo: "EXAUSTOR",
        nome: "Exaustor DEMO",
        ativo: true,
        perguntas: [
          { chave: "tipo_controle", texto: "Tipo de controle", tipo: "SELECAO_UNICA", obrigatoria: false, ordem: 0, opcoes: [{ valor: "simultaneo", rotulo: "Simultâneo" }, { valor: "grupos", rotulo: "Por grupos" }] },
        ],
        modelos: [{ id: "m1", nome: "Modelo 01", ativo: true, atributos: { potencia: 1.5 }, perguntas: [] }],
      },
    },
    tiposDePainel: { ctrl: { id: "ctrl", nome: "Controle", ativo: true } },
    modelosDeTexto: modelos,
  };
}

const config = (q: number, extra: Partial<ConfiguracaoDoProjeto> = {}): ConfiguracaoDoProjeto => ({
  schemaVersion: 1,
  ambientes: [
    { id: "a1", nome: "Aviário 1" },
    { id: "a2", nome: "Aviário 2" },
  ],
  paineis: [{ id: "p1", identificacao: "QC-01", tipoId: "ctrl", tensao: 220, ambientes: ["a1"] }],
  instancias: [{ id: "i1", equipamentoId: "exa", modeloId: "m1", quantidade: q, fornecimento: "fornecido", ambientes: ["a1", "a2"], painelId: "p1", respostas: { tipo_controle: "grupos" } }],
  ...extra,
});

describe("descritivo técnico (Fase 10)", () => {
  it("preenche variáveis com plural e formatação brasileira", () => {
    const ctx = { quantidade: 4, "modelo.nome": "Modelo 01", "modelo.potencia": 1.5 };
    expect(preencherTexto("{{quantidade}} {{plural:exaustor|exaustores}} {{modelo.nome}} de {{modelo.potencia}} cv", ctx).texto).toBe("4 exaustores Modelo 01 de 1,5 cv");
    expect(preencherTexto("{{quantidade}} {{plural:exaustor|exaustores}}", { quantidade: 1 }).texto).toBe("1 exaustor");
    expect(preencherTexto("Tensão {{painel.tensao}} V", {})).toEqual({ texto: "Tensão V", faltando: ["painel.tensao"] });
  });

  it("monta as seções na ordem fixa, por instância, painel e projeto, respeitando a condição", () => {
    const s = snap([
      texto({ id: "t1", dono: { tipo: "modelo", id: "m1" }, texto: "{{quantidade}} {{plural:exaustor|exaustores}} {{modelo.nome}} atendendo {{ambiente.nome}}." }),
      texto({
        id: "t2",
        dono: { tipo: "equipamento", id: "exa" },
        texto: "Controle por grupos.",
        condicao: { tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "igual", valor: "grupos" },
        ordem: 1,
      }),
      texto({ id: "t3", dono: { tipo: "equipamento", id: "exa" }, texto: "Controle simultâneo.", condicao: { tipo: "comparacao", variavel: "resposta.tipo_controle", operador: "igual", valor: "simultaneo" } }),
      texto({ id: "t4", secao: "paineis", dono: { tipo: "tipoDePainel", id: "ctrl" }, texto: "Painel {{painel.identificacao}} em {{painel.tensao}} V." }),
      texto({ id: "t5", secao: "objeto", dono: { tipo: "projeto" }, texto: "Automação de {{ambiente.nome}}." }),
    ]);
    const r = calcular(config(4), s);
    expect(r.descritivo.map((x) => x.id)).toEqual(["objeto", "equipamentos", "paineis"]);
    expect(r.descritivo[0]!.paragrafos[0]!.texto).toBe("Automação de Aviário 1 e Aviário 2.");
    expect(r.descritivo[1]!.paragrafos.map((p) => p.texto)).toEqual(["4 exaustores Modelo 01 atendendo Aviário 1 e Aviário 2.", "Controle por grupos."]);
    expect(r.descritivo[2]!.paragrafos[0]!.texto).toBe("Painel QC-01 em 220 V.");
  });

  it("texto editado substitui o gerado e fica marcado como desatualizado se a configuração mudar", () => {
    const s = snap([texto({ id: "t1", dono: { tipo: "modelo", id: "m1" }, texto: "{{quantidade}} {{plural:exaustor|exaustores}}." })]);
    const base = calcular(config(4), s).descritivo[0]!.paragrafos[0]!;
    expect(base.chave).toBe("t1:i:i1");
    const editada = editarTrechoDoDescritivo(config(4), base.chave, "Quatro exaustores novos.", base.gerado);
    const r1 = calcular(editada, s).descritivo[0]!.paragrafos[0]!;
    expect(r1).toMatchObject({ texto: "Quatro exaustores novos.", editado: true, desatualizado: false });
    const mudou = { ...editada, instancias: editada.instancias.map((i) => ({ ...i, quantidade: 6 })) };
    const r2 = calcular(mudou, s);
    expect(r2.descritivo[0]!.paragrafos[0]).toMatchObject({ texto: "Quatro exaustores novos.", gerado: "6 exaustores.", desatualizado: true });
    expect(r2.pendencias.map((p) => p.codigo)).toContain("TEXTO_EDITADO_DESATUALIZADO");
    const restaurada = editarTrechoDoDescritivo(mudou, base.chave, null, "");
    expect(calcular(restaurada, s).descritivo[0]!.paragrafos[0]!.texto).toBe("6 exaustores.");
  });

  it("edição de trecho que deixou de existir vira pendência", () => {
    const s = snap([texto({ id: "t1", dono: { tipo: "modelo", id: "m1" }, texto: "x" })]);
    const c = editarTrechoDoDescritivo(config(1), "t1:i:outra", "y", "x");
    expect(calcular(c, s).pendencias.map((p) => p.codigo)).toContain("TEXTO_EDITADO_SEM_TRECHO");
  });
});
