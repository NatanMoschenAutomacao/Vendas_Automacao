import "server-only";
import { atributosFaltantes } from "@zanatta/engine";
import { db } from "@/server/db";
import { exigirPermissao } from "@/server/auth/dal";
import { urlDaImagem } from "@/server/arquivos/armazenamento";

const imagemSelect = { select: { chave: true, textoAlternativo: true, largura: true, altura: true } } as const;

export async function listarEquipamentos() {
  await exigirPermissao("biblioteca:ver");
  const itens = await db.equipamento.findMany({
    orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    select: {
      id: true,
      codigo: true,
      nome: true,
      tipo: true,
      categoriaId: true,
      ordem: true,
      ativo: true,
      isDemo: true,
      imagem: imagemSelect,
      _count: { select: { modelos: true, definicoes: true } },
    },
  });
  return itens.map(({ imagem, ...e }) => ({ ...e, imagemUrl: urlDaImagem(imagem?.chave) }));
}

export async function obterEquipamento(id: string) {
  await exigirPermissao("biblioteca:ver");
  const e = await db.equipamento.findUnique({
    where: { id },
    include: {
      categoria: { select: { id: true, nome: true } },
      imagem: imagemSelect,
      definicoes: { orderBy: [{ ordem: "asc" }, { rotulo: "asc" }] },
      modelos: {
        orderBy: [{ ordem: "asc" }, { nome: "asc" }],
        include: { imagem: imagemSelect },
      },
    },
  });
  if (!e) return null;
  return {
    ...e,
    imagemUrl: urlDaImagem(e.imagem?.chave),
    modelos: e.modelos.map((m) => {
      const valores = (m.atributos ?? {}) as Record<string, unknown>;
      return {
        ...m,
        valores,
        imagemUrl: urlDaImagem(m.imagem?.chave),
        faltantes: atributosFaltantes(e.definicoes, valores),
      };
    }),
  };
}

export type EquipamentoDetalhado = NonNullable<Awaited<ReturnType<typeof obterEquipamento>>>;
