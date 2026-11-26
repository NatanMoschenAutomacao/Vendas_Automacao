import { expect, test, type Page } from "@playwright/test";

const SENHA_INICIAL = process.env.SEED_ADMIN_SENHA ?? "Trocar@123";
const SENHA_NOVA = "NovaSenha2026";

async function entrar(page: Page, usuario: string, senha: string) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(usuario);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
}

test("fluxo da Fase 01: login, troca de senha, categorias, usuários e permissões", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);

  await entrar(page, "admin", "errada123");
  await expect(page.getByText("Usuário ou senha inválidos.")).toBeVisible();

  await entrar(page, "admin", SENHA_INICIAL);
  await expect(page).toHaveURL(/\/trocar-senha$/);
  await page.getByLabel("Senha atual").fill(SENHA_INICIAL);
  await page.getByLabel("Nova senha", { exact: true }).fill(SENHA_NOVA);
  await page.getByLabel("Confirmar nova senha").fill(SENHA_NOVA);
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // Categorias: o seed cria as categorias do §8.
  await page.getByRole("link", { name: "Categorias e sistemas" }).first().click();
  const arvore = page.getByRole("region", { name: "Árvore de categorias" });
  await expect(arvore.getByText("Climatização", { exact: true })).toBeVisible();
  await expect(arvore.getByText("Exaustores", { exact: true })).toBeVisible();

  await page.getByLabel("Nome").fill("Teste E2E");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText('Categoria "Teste E2E" criada.')).toBeVisible();
  await page.reload();
  await expect(arvore.getByText("Teste E2E", { exact: true })).toBeVisible();

  // Nome repetido no mesmo nível é recusado.
  await page.getByLabel("Nome").fill("Teste E2E");
  await page.getByRole("button", { name: "Adicionar" }).click();
  await expect(page.getByText("Já existe uma categoria com esse nome neste nível.")).toBeVisible();

  // Usuários: cria um vendedor.
  await page.goto("/admin/usuarios");
  await page.getByLabel("Usuário (login)").fill("vendedor1");
  await page.getByLabel("Nome", { exact: true }).fill("Vendedor Um");
  await page.getByLabel("Senha temporária").fill("Temp12345");
  await page.getByRole("button", { name: "Criar usuário" }).click();
  await expect(page.getByText("Usuário vendedor1 criado.", { exact: false })).toBeVisible();

  // Sai e entra como vendedor.
  await page.getByTitle("Sair").click();
  await expect(page).toHaveURL(/\/login$/);
  await entrar(page, "vendedor1", "Temp12345");
  await page.getByLabel("Senha atual").fill("Temp12345");
  await page.getByLabel("Nova senha", { exact: true }).fill("Vendedor2026");
  await page.getByLabel("Confirmar nova senha").fill("Vendedor2026");
  await page.getByRole("button", { name: "Salvar senha" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Nenhum orçamento ainda")).toBeVisible();
  await expect(page.getByRole("link", { name: "Administração" })).toHaveCount(0);

  // O vendedor não acessa a administração nem digitando a URL.
  await page.goto("/admin/categorias");
  await expect(page).toHaveURL(/\/$/);
});
