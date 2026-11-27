import { armazenamento } from "@/server/arquivos/armazenamento";
import { exigirUsuario } from "@/server/auth/dal";

const TIPOS: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serve as imagens do armazenamento local (desenvolvimento e testes). */
export async function GET(_: Request, ctx: RouteContext<"/arquivos/[...chave]">) {
  await exigirUsuario();
  const chave = (await ctx.params).chave.join("/");
  let bytes: Uint8Array | null = null;
  try {
    bytes = await armazenamento().ler(chave);
  } catch {
    bytes = null;
  }
  if (!bytes) return new Response("Não encontrado", { status: 404 });
  const ext = chave.split(".").pop() ?? "";
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": TIPOS[ext] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
