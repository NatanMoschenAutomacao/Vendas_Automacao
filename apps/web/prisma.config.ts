import "dotenv/config";
import { defineConfig } from "prisma/config";

// Migrations usam a conexão direta (DIRECT_URL). No Supabase, DATABASE_URL
// aponta para o pooler (porta 6543), que não serve para migrations.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
