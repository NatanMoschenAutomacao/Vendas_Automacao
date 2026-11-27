/**
 * Validação de imagens enviadas: só JPEG, PNG e WebP, conferidos pelos bytes
 * iniciais (não pela extensão), com limite de tamanho. SVG é recusado por
 * poder conter scripts.
 */
export const TAMANHO_MAXIMO_IMAGEM = 4 * 1024 * 1024;

export type TipoDeImagem = "image/jpeg" | "image/png" | "image/webp";

export const EXTENSAO: Record<TipoDeImagem, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export interface InfoDaImagem {
  tipo: TipoDeImagem;
  largura: number | null;
  altura: number | null;
}

export function detectarTipo(b: Uint8Array): TipoDeImagem | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (
    b.length >= 8 &&
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v)
  )
    return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

function ascii(b: Uint8Array, inicio: number, n: number) {
  return String.fromCharCode(...b.subarray(inicio, inicio + n));
}

function u16be(b: Uint8Array, i: number) {
  return ((b[i] ?? 0) << 8) | (b[i + 1] ?? 0);
}
function u32be(b: Uint8Array, i: number) {
  return ((b[i] ?? 0) * 2 ** 24) + (((b[i + 1] ?? 0) << 16) | ((b[i + 2] ?? 0) << 8) | (b[i + 3] ?? 0));
}
function u16le(b: Uint8Array, i: number) {
  return (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8);
}
function u24le(b: Uint8Array, i: number) {
  return (b[i] ?? 0) | ((b[i + 1] ?? 0) << 8) | ((b[i + 2] ?? 0) << 16);
}

function dimensoes(tipo: TipoDeImagem, b: Uint8Array): [number, number] | null {
  if (tipo === "image/png") {
    if (b.length < 24 || ascii(b, 12, 4) !== "IHDR") return null;
    return [u32be(b, 16), u32be(b, 20)];
  }
  if (tipo === "image/webp") {
    const bloco = ascii(b, 12, 4);
    if (bloco === "VP8X" && b.length >= 30) return [u24le(b, 24) + 1, u24le(b, 27) + 1];
    if (bloco === "VP8 " && b.length >= 30) return [u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff];
    if (bloco === "VP8L" && b.length >= 25) {
      const v = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
      return [(v & 0x3fff) + 1, ((v >>> 14) & 0x3fff) + 1];
    }
    return null;
  }
  // JPEG: procura o marcador SOF (C0–CF, exceto C4, C8 e CC).
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1] ?? 0;
    if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01 || m === 0xff) {
      i += m === 0xff ? 1 : 2;
      continue;
    }
    const tam = u16be(b, i + 2);
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return [u16be(b, i + 7), u16be(b, i + 5)];
    }
    i += 2 + tam;
  }
  return null;
}

export type ResultadoDeImagem = { ok: true; info: InfoDaImagem } | { ok: false; erro: string };

export function validarImagem(bytes: Uint8Array): ResultadoDeImagem {
  if (bytes.length === 0) return { ok: false, erro: "Arquivo vazio." };
  if (bytes.length > TAMANHO_MAXIMO_IMAGEM) return { ok: false, erro: "A imagem deve ter no máximo 4 MB." };
  const tipo = detectarTipo(bytes);
  if (!tipo) return { ok: false, erro: "Envie uma imagem JPG, PNG ou WebP." };
  const d = dimensoes(tipo, bytes);
  return { ok: true, info: { tipo, largura: d?.[0] ?? null, altura: d?.[1] ?? null } };
}
