import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Armazenamento de arquivos. Em produção usa o Supabase Storage (plano
 * gratuito) quando SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY existem; no
 * desenvolvimento e nos testes grava em apps/web/.uploads.
 */
export interface ArmazenamentoDeArquivos {
  salvar(chave: string, bytes: Uint8Array, tipoMime: string): Promise<void>;
  ler(chave: string): Promise<Uint8Array | null>;
  remover(chave: string): Promise<void>;
  /** URL usada no navegador para exibir o arquivo. */
  url(chave: string): string;
}

const CHAVE_SEGURA = /^[a-z0-9][a-z0-9/_-]*\.(jpg|png|webp)$/;

function conferirChave(chave: string) {
  if (!CHAVE_SEGURA.test(chave) || chave.includes("..")) throw new Error("Chave de arquivo inválida.");
}

class ArmazenamentoLocal implements ArmazenamentoDeArquivos {
  constructor(private readonly pasta: string) {}
  private caminho(chave: string) {
    conferirChave(chave);
    return path.join(this.pasta, chave);
  }
  async salvar(chave: string, bytes: Uint8Array) {
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      // Em função serverless (Netlify) o disco é temporário: a imagem se perderia.
      throw new Error("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para enviar imagens.");
    }
    const c = this.caminho(chave);
    await mkdir(path.dirname(c), { recursive: true });
    await writeFile(c, bytes);
  }
  async ler(chave: string) {
    try {
      return new Uint8Array(await readFile(this.caminho(chave)));
    } catch {
      return null;
    }
  }
  async remover(chave: string) {
    await rm(this.caminho(chave), { force: true });
  }
  url(chave: string) {
    return `/arquivos/${chave}`;
  }
}

class ArmazenamentoSupabase implements ArmazenamentoDeArquivos {
  private bucketPronto: Promise<void> | null = null;
  constructor(
    private readonly base: string,
    private readonly chaveServico: string,
    private readonly bucket: string,
  ) {}

  private cabecalhos(extra?: Record<string, string>) {
    // Chaves novas (sb_secret_...) vão só no cabeçalho apikey; as antigas (JWT service_role) também no Authorization.
    const jwt = this.chaveServico.startsWith("eyJ");
    return {
      apikey: this.chaveServico,
      ...(jwt ? { Authorization: `Bearer ${this.chaveServico}` } : {}),
      ...extra,
    };
  }

  /** Cria o bucket público na primeira gravação, se ainda não existir. */
  private garantirBucket() {
    this.bucketPronto ??= (async () => {
      const r = await fetch(`${this.base}/storage/v1/bucket/${this.bucket}`, { headers: this.cabecalhos() });
      if (r.ok) return;
      const c = await fetch(`${this.base}/storage/v1/bucket`, {
        method: "POST",
        headers: this.cabecalhos({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: this.bucket, name: this.bucket, public: true }),
      });
      if (!c.ok && c.status !== 409) {
        this.bucketPronto = null;
        throw new Error(`Não foi possível criar o bucket de imagens (${c.status}).`);
      }
    })();
    return this.bucketPronto;
  }

  async salvar(chave: string, bytes: Uint8Array, tipoMime: string) {
    conferirChave(chave);
    await this.garantirBucket();
    const r = await fetch(`${this.base}/storage/v1/object/${this.bucket}/${chave}`, {
      method: "POST",
      headers: this.cabecalhos({ "Content-Type": tipoMime, "x-upsert": "true", "Cache-Control": "max-age=31536000" }),
      body: Buffer.from(bytes),
    });
    if (!r.ok) throw new Error(`Falha ao enviar a imagem (${r.status}).`);
  }
  async ler(chave: string) {
    conferirChave(chave);
    const r = await fetch(this.url(chave));
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  }
  async remover(chave: string) {
    conferirChave(chave);
    await fetch(`${this.base}/storage/v1/object/${this.bucket}`, {
      method: "DELETE",
      headers: this.cabecalhos({ "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [chave] }),
    });
  }
  url(chave: string) {
    return `${this.base}/storage/v1/object/public/${this.bucket}/${chave}`;
  }
}

let instancia: ArmazenamentoDeArquivos | null = null;

export function armazenamento(): ArmazenamentoDeArquivos {
  if (instancia) return instancia;
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  instancia =
    url && chave
      ? new ArmazenamentoSupabase(url, chave, process.env.SUPABASE_BUCKET ?? "imagens")
      : new ArmazenamentoLocal(process.env.PASTA_DE_UPLOADS ?? path.join(process.cwd(), ".uploads"));
  return instancia;
}

export function urlDaImagem(chave: string | null | undefined): string | null {
  return chave ? armazenamento().url(chave) : null;
}
