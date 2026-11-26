import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "@node-rs/argon2";
import { PrismaClient } from "../../src/generated/prisma/client";
import { CATEGORIAS_INICIAIS } from "./categorias-iniciais";

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }),
});

async function main() {
  const usuario = (process.env.SEED_ADMIN_USUARIO ?? "admin").toLowerCase();
  const senha = process.env.SEED_ADMIN_SENHA;

  if (await db.usuario.findUnique({ where: { usuario } })) {
    console.log(`Administrador "${usuario}" já existe; mantido.`);
  } else {
    if (!senha) throw new Error("Defina SEED_ADMIN_SENHA para criar o primeiro administrador.");
    await db.usuario.create({
      data: { usuario, nome: "Administrador", perfil: "ADMIN_TECNICO", senhaHash: await hash(senha), trocarSenha: true },
    });
    console.log(`Administrador "${usuario}" criado (troca de senha obrigatória no primeiro acesso).`);
  }

  if ((await db.categoria.count()) > 0) {
    console.log("Categorias já existem; seed de categorias ignorado.");
    return;
  }
  let ordemPai = 0;
  for (const [nome, sistemas] of Object.entries(CATEGORIAS_INICIAIS)) {
    const pai = await db.categoria.create({ data: { nome, ordem: ordemPai++ } });
    await db.categoria.createMany({
      data: sistemas.map((s, ordem) => ({ nome: s, paiId: pai.id, ordem })),
    });
  }
  console.log(`${Object.keys(CATEGORIAS_INICIAIS).length} categorias iniciais criadas.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
