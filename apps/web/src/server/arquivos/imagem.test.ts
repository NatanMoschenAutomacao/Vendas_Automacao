import { describe, expect, it } from "vitest";
import { TAMANHO_MAXIMO_IMAGEM, detectarTipo, validarImagem } from "./imagem";

// PNG 1x1 real.
const PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
);

function jpeg(largura: number, altura: number) {
  return Uint8Array.from([
    0xff, 0xd8, // SOI
    0xff, 0xe0, 0x00, 0x10, ...Array(14).fill(0), // APP0
    0xff, 0xc0, 0x00, 0x11, 0x08, altura >> 8, altura & 0xff, largura >> 8, largura & 0xff, 0x03,
    ...Array(9).fill(0),
    0xff, 0xd9,
  ]);
}

function webpVp8x(largura: number, altura: number) {
  const b = new Uint8Array(30);
  b.set(Buffer.from("RIFF"), 0);
  b.set(Buffer.from("WEBPVP8X"), 8);
  const w = largura - 1;
  const h = altura - 1;
  b.set([w & 0xff, (w >> 8) & 0xff, (w >> 16) & 0xff, h & 0xff, (h >> 8) & 0xff, (h >> 16) & 0xff], 24);
  return b;
}

describe("validarImagem", () => {
  it("lê PNG", () => {
    expect(validarImagem(PNG)).toEqual({ ok: true, info: { tipo: "image/png", largura: 1, altura: 1 } });
  });
  it("lê JPEG", () => {
    expect(validarImagem(jpeg(640, 480))).toEqual({ ok: true, info: { tipo: "image/jpeg", largura: 640, altura: 480 } });
  });
  it("lê WebP", () => {
    expect(validarImagem(webpVp8x(1920, 1080))).toEqual({
      ok: true,
      info: { tipo: "image/webp", largura: 1920, altura: 1080 },
    });
  });
  it("recusa SVG e texto disfarçado", () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');
    expect(detectarTipo(svg)).toBeNull();
    expect(validarImagem(svg)).toEqual({ ok: false, erro: "Envie uma imagem JPG, PNG ou WebP." });
  });
  it("recusa vazio e acima do limite", () => {
    expect(validarImagem(new Uint8Array())).toMatchObject({ ok: false });
    const grande = new Uint8Array(TAMANHO_MAXIMO_IMAGEM + 1);
    grande.set(PNG);
    expect(validarImagem(grande)).toEqual({ ok: false, erro: "A imagem deve ter no máximo 4 MB." });
  });
});
