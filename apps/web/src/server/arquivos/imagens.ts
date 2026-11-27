import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/server/db";
import { armazenamento } from "./armazenamento";
import { EXTENSAO, validarImagem } from "./imagem";

export type ResultadoDoEnvio = { ok: true; imagemId: string; chave: string } | { ok: false; erro: string };

/**
 * Lê o arquivo do formulário, valida (tipo real e tamanho), grava no
 * armazenamento e cria o registro da imagem. `pasta` agrupa os arquivos
 * (ex.: "kits/<id>").
 */
export async function armazenarImagemDoFormulario(form: FormData, pasta: string, campo = "arquivo"): Promise<ResultadoDoEnvio> {
  const arquivo = form.get(campo);
  if (!(arquivo instanceof File) || arquivo.size === 0) return { ok: false, erro: "Escolha uma imagem." };
  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const v = validarImagem(bytes);
  if (!v.ok) return { ok: false, erro: v.erro };
  const chave = `${pasta}/${randomUUID()}.${EXTENSAO[v.info.tipo]}`;
  try {
    await armazenamento().salvar(chave, bytes, v.info.tipo);
  } catch (e) {
    return { ok: false, erro: e instanceof Error ? e.message : "Falha ao salvar a imagem." };
  }
  const textoAlternativo = String(form.get("textoAlternativo") ?? "").trim().slice(0, 200) || null;
  const img = await db.imagem.create({
    data: {
      chave,
      nomeArquivo: arquivo.name.slice(0, 200) || "imagem",
      tipoMime: v.info.tipo,
      tamanho: bytes.length,
      largura: v.info.largura,
      altura: v.info.altura,
      textoAlternativo,
    },
  });
  return { ok: true, imagemId: img.id, chave };
}

/** Apaga a imagem do banco e do armazenamento se nenhum cadastro a usa mais. */
export async function limparImagemOrfa(imagemId: string) {
  const usos = await Promise.all([
    db.equipamento.count({ where: { imagemId } }),
    db.modelo.count({ where: { imagemId } }),
    db.kit.count({ where: { imagemId } }),
    db.imagemInterativa.count({ where: { imagemId } }),
  ]);
  if (usos.some((n) => n > 0)) return;
  const img = await db.imagem.delete({ where: { id: imagemId } }).catch(() => null);
  if (img) await armazenamento().remover(img.chave).catch(() => undefined);
}
