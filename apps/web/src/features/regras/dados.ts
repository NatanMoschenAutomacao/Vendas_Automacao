import "server-only";
import { resolverPerguntas, type DescricaoDeVariavel, type DonoDaRegra } from "@zanatta/engine";
import { db } from "@/server/db";
import { carregarPerguntasDoEquipamento } from "@/features/perguntas/dados";
import { VARIAVEIS_DA_INSTANCIA, variavelDaPergunta, variaveisDoModelo, variaveisDoProjeto } from "@/features/perguntas/variaveis";

const UUID = /^[0-9a-f-]{36}$/i;

/** Lê o dono a partir dos parâmetros da URL (?dono=equipamento&id=…). */
export function lerDono(tipo: unknown, id: unknown): DonoDaRegra | null {
  if (tipo === "projeto") return { tipo: "projeto" };
  if ((tipo === "equipamento" || tipo === "modelo" || tipo === "tipoDePainel") && typeof id === "string" && UUID.test(id)) return { tipo, id };
  return null;
}

export function donoDoBanco(r: { donoTipo: string; equipamentoId: string | null; modeloId: string | null; tipoDePainelId: string | null }): DonoDaRegra {
  if (r.donoTipo === "EQUIPAMENTO") return { tipo: "equipamento", id: r.equipamentoId! };
  if (r.donoTipo === "MODELO") return { tipo: "modelo", id: r.modeloId! };
  if (r.donoTipo === "TIPO_DE_PAINEL") return { tipo: "tipoDePainel", id: r.tipoDePainelId! };
  return { tipo: "projeto" };
}

export function donoParaBanco(d: DonoDaRegra) {
  return {
    donoTipo: ({ equipamento: "EQUIPAMENTO", modelo: "MODELO", tipoDePainel: "TIPO_DE_PAINEL", projeto: "PROJETO" } as const)[d.tipo],
    equipamentoId: d.tipo === "equipamento" ? d.id : null,
    modeloId: d.tipo === "modelo" ? d.id : null,
    tipoDePainelId: d.tipo === "tipoDePainel" ? d.id : null,
  };
}

export interface ContextoDoDono {
  rotulo: string;
  voltar: string;
  comuns: DescricaoDeVariavel[];
}

/** Nome do dono, link de volta e variáveis comuns. Null quando o dono não existe. */
export async function carregarDono(dono: DonoDaRegra): Promise<ContextoDoDono | null> {
  const equipamentos = await db.equipamento.findMany({ where: { ativo: true }, orderBy: { nome: "asc" }, select: { codigo: true, nome: true } });
  const doProjeto: DescricaoDeVariavel[] = [
    { nome: "projeto.ambientes", rotulo: "Projeto › Quantidade de ambientes", tipo: "numero" },
    ...variaveisDoProjeto(equipamentos),
  ];
  if (dono.tipo === "projeto") return { rotulo: "Projeto", voltar: "/admin/regras", comuns: doProjeto };
  if (dono.tipo === "tipoDePainel") {
    const t = await db.tipoDePainel.findUnique({ where: { id: dono.id }, select: { nome: true } });
    return t ? { rotulo: `Tipo de painel: ${t.nome}`, voltar: "/admin/regras", comuns: doProjeto } : null;
  }
  const equipamentoId =
    dono.tipo === "equipamento" ? dono.id : (await db.modelo.findUnique({ where: { id: dono.id }, select: { equipamentoId: true } }))?.equipamentoId;
  if (!equipamentoId) return null;
  const eq = await carregarPerguntasDoEquipamento(equipamentoId).catch(() => null);
  if (!eq) return null;
  const modelo = dono.tipo === "modelo" ? eq.modelosMotor.find((m) => m.id === dono.id) : undefined;
  const conjuntos = modelo
    ? [resolverPerguntas(eq.perguntasMotor, modelo.perguntas).perguntas]
    : [eq.perguntasMotor, ...eq.modelosMotor.map((m) => resolverPerguntas(eq.perguntasMotor, m.perguntas).perguntas)];
  const porNome = new Map<string, DescricaoDeVariavel>();
  for (const lista of conjuntos) for (const p of lista) {
    const v = variavelDaPergunta(p, eq.definicoes);
    if (!porNome.has(v.nome)) porNome.set(v.nome, v);
  }
  return {
    rotulo: modelo ? `Modelo: ${eq.nome} › ${modelo.nome}` : `Equipamento: ${eq.nome}`,
    voltar: modelo ? `/admin/equipamentos/${eq.id}/modelos/${modelo.id}` : `/admin/equipamentos/${eq.id}?aba=materiais`,
    comuns: [...porNome.values(), ...variaveisDoModelo(eq.definicoes), ...VARIAVEIS_DA_INSTANCIA, ...doProjeto],
  };
}

/** Itens e tipos de recurso que o editor oferece. */
export async function carregarOpcoesDoEditor() {
  const [itens, recursos] = await Promise.all([
    db.itemDeCatalogo.findMany({ orderBy: { codigo: "asc" }, select: { id: true, codigo: true, descricao: true, unidade: true, ativo: true } }),
    db.tipoDeRecurso.findMany({ orderBy: [{ ordem: "asc" }, { codigo: "asc" }], select: { id: true, codigo: true, nome: true, ativo: true } }),
  ]);
  return { itens, recursos };
}
