import { defineConfig } from "@playwright/test";

// Testes de interface ponta a ponta. Use `pnpm test:e2e`, que cria um banco
// novo e descartável, aplica as migrations, roda o seed e sobe o servidor.
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    launchOptions: process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : undefined,
  },
});
