import { expect, test, type Page } from "@playwright/test";

// Roda depois da fase09: a Granja Exemplo tem itens sem preço (pendências impeditivas).
// Todos os textos abaixo são DEMO, criados só para o teste.

async function entrar(page: Page, usuario: string, senha: string, destino: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(usuario);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(destino);
}

async function abrir(page: Page, nome: RegExp) {
  await page.goto("/");
  await page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: nome }).click();
  await expect(page.getByRole("region", { name: "Situação e documentos" })).toBeVisible();
}

const situacao = (page: Page) => page.getByRole("region", { name: "Situação e documentos" });

test("Fase 10: descritivo, documentos, status e emissão congelada", async ({ page }) => {
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);

  // Modelo de texto do projeto, com variável e plural.
  await page.goto("/admin/modelos-de-texto");
  await page.getByRole("form", { name: "Novo modelo de texto" }).getByRole("button", { name: "Continuar" }).click();
  const editor = page.getByRole("form", { name: "Modelo de texto" });
  await editor.getByRole("combobox", { name: "Seção do descritivo", exact: true }).selectOption("objeto");
  await editor.getByLabel("Texto", { exact: true }).fill("Automação do projeto com {{quantidade}} {{plural:equipamento|equipamentos}}.");
  await expect(editor.locator('[data-campo="exemplo"]')).toHaveText("Automação do projeto com 4 equipamentos.");
  await editor.getByLabel("Dado de demonstração (DEMO)").check();
  await editor.getByRole("button", { name: "Salvar modelo de texto" }).click();
  await expect(page.getByText("Modelo de texto criado.")).toBeVisible();

  // ───────── Vendedor: descritivo, documentos e envio para validação ─────────
  await page.context().clearCookies();
  await entrar(page, "vendedor1", "Vendedor2026", /\/$/);
  await abrir(page, /Granja Exemplo/);
  await page.getByRole("button", { name: "Descritivo", exact: true }).click();
  const descritivo = page.getByRole("region", { name: "Descritivo técnico" });
  await expect(descritivo.getByText(/^Automação do projeto com \d+ equipamentos\.$/)).toBeVisible();
  await descritivo.getByRole("button", { name: "Editar trecho" }).click();
  await descritivo.getByLabel("Texto do trecho").fill("Automação completa do Aviário 3 (texto editado DEMO).");
  await descritivo.getByRole("button", { name: "Salvar trecho" }).click();
  await expect(descritivo.locator("[data-editado]")).toContainText("texto editado DEMO");
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();

  // Documentos de prévia: o vendedor baixa a proposta e as listas, mas não o orçamento interno.
  const base = page.url().replace(/\/$/, "") + "/documentos";
  const proposta = await page.request.get(`${base}/proposta.pdf`);
  expect(proposta.status()).toBe(200);
  expect(proposta.headers()["content-type"]).toBe("application/pdf");
  expect(proposta.headers()["content-disposition"]).toMatch(/-previa\.pdf"/);
  expect((await proposta.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await page.request.get(`${base}/listas.xlsx`)).status()).toBe(200);
  expect((await page.request.get(`${base}/interno.pdf`)).status()).toBe(403);
  await expect(situacao(page).getByRole("link", { name: /Orçamento interno/ })).toHaveCount(0);

  await situacao(page).getByRole("button", { name: "Enviar para validação" }).click();
  await expect(situacao(page).locator("[data-status]")).toHaveAttribute("data-status", "AGUARDANDO_VALIDACAO");
  await page.getByRole("button", { name: "Descritivo", exact: true }).click();
  await expect(page.getByRole("button", { name: "Editar trecho" })).toHaveCount(0);

  // ───────── Administrador: validação recusada por pendências impeditivas ─────────
  await page.context().clearCookies();
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);
  await abrir(page, /Granja Exemplo/);
  await situacao(page).getByRole("button", { name: "Validar" }).click();
  await expect(situacao(page).getByText(/pendência\(s\) impeditiva\(s\)/)).toBeVisible();
  await situacao(page).getByRole("button", { name: "Voltar para rascunho" }).click();
  await expect(situacao(page).locator("[data-status]")).toHaveAttribute("data-status", "RASCUNHO");
  const interno = await page.request.get(page.url().replace(/\/$/, "") + "/documentos/interno.xlsx");
  expect(interno.status()).toBe(200);

  // ───────── Orçamento sem pendências: validar, emitir e abrir nova revisão ─────────
  await page.goto("/");
  await page.getByRole("link", { name: "Novo orçamento" }).click();
  await page.getByLabel("Cliente").fill("Cliente Emissão DEMO");
  await page.getByLabel("Projeto").fill("Projeto DEMO");
  await page.getByRole("button", { name: "Criar e configurar" }).click();
  await expect(situacao(page)).toBeVisible();
  await situacao(page).getByRole("button", { name: "Validar" }).click();
  await expect(situacao(page).locator("[data-status]")).toHaveAttribute("data-status", "VALIDADO");
  await situacao(page).getByRole("button", { name: "Emitir" }).click();
  await expect(situacao(page).getByText("Revisão 1 emitida.", { exact: false })).toBeVisible();
  await expect(situacao(page).locator("[data-status]")).toHaveAttribute("data-status", "EMITIDO");
  const emitida = await page.request.get(page.url().replace(/\/$/, "") + "/documentos/proposta.pdf");
  expect(emitida.status()).toBe(200);
  expect(emitida.headers()["content-disposition"]).toMatch(/rev1\.pdf"/);

  await situacao(page).getByRole("button", { name: "Abrir nova revisão" }).click();
  await expect(situacao(page).locator("[data-status]")).toHaveAttribute("data-status", "RASCUNHO");
  await expect(situacao(page)).toContainText("Revisão 2.");
});
