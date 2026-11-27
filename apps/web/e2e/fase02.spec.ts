import { expect, test, type Page } from "@playwright/test";

// Roda depois de fase01.spec.ts (workers: 1, ordem alfabética), que troca a senha do admin.
const SENHA_ADMIN = "NovaSenha2026";

// PNG 1x1 válido.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function entrarComoAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("admin");
  await page.getByLabel("Senha").fill(SENHA_ADMIN);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test("Fase 02: cadastro de equipamento novo sem alterar código", async ({ page }) => {
  await entrarComoAdmin(page);
  await page.getByRole("link", { name: "Equipamentos e modelos" }).first().click();
  await expect(page.getByText("Nenhum equipamento cadastrado.")).toBeVisible();

  // Cria o equipamento.
  await page.getByLabel("Código").fill("exaustor-demo");
  await page.getByLabel("Nome do equipamento").fill("Exaustor");
  await page.getByLabel("Categoria").selectOption({ label: "— Exaustores" });
  await page.getByLabel("Dado de exemplo (DEMO)").check();
  await page.getByRole("button", { name: "Criar equipamento" }).click();
  await expect(page).toHaveURL(/aba=caracteristicas/);
  await expect(page.getByRole("heading", { name: "Exaustor" })).toBeVisible();
  await expect(page.getByText("EXAUSTOR-DEMO", { exact: false }).first()).toBeVisible();

  // Código repetido é recusado.
  await page.goto("/admin/equipamentos");
  await page.getByLabel("Código").fill("EXAUSTOR-DEMO");
  await page.getByLabel("Nome do equipamento").fill("Outro");
  await page.getByLabel("Categoria").selectOption({ label: "— Exaustores" });
  await page.getByRole("button", { name: "Criar equipamento" }).click();
  await expect(page.getByText("Já existe um equipamento com esse código.")).toBeVisible();
  await page.getByRole("region", { name: "Lista de equipamentos" }).getByRole("link", { name: /Exaustor/ }).click();

  // Características: padrão elétrico + campo próprio obrigatório.
  await page.getByRole("link", { name: /Características/ }).click();
  await page.getByRole("button", { name: "Adicionar características elétricas padrão" }).click();
  const campos = page.getByRole("region", { name: "Campos técnicos" });
  await expect(campos.getByText("Potência", { exact: true })).toBeVisible();
  await expect(campos.getByText("Comunicação", { exact: true })).toBeVisible();

  const novo = page.getByRole("form", { name: "Novo campo" });
  await novo.getByLabel("Nome do campo").fill("Vazão");
  await novo.getByLabel("Tipo de dado").selectOption("NUMERO");
  await novo.getByLabel("Unidade").fill("m³/h");
  await novo.getByLabel("Obrigatório nos modelos").check();
  await novo.getByRole("button", { name: "Adicionar campo" }).click();
  await expect(page.getByText('Campo "Vazão" adicionado.')).toBeVisible();
  await expect(campos.getByText("Vazão", { exact: true })).toBeVisible();

  // Lista sem opções é recusada.
  await novo.getByLabel("Nome do campo").fill("Acionamento");
  await novo.getByLabel("Tipo de dado").selectOption("LISTA");
  await novo.getByRole("button", { name: "Adicionar campo" }).click();
  await expect(page.getByText("Informe ao menos uma opção.")).toBeVisible();

  // Modelos.
  await page.getByRole("link", { name: /Modelos/ }).first().click();
  const formModelo = page.getByRole("form", { name: "Novo modelo" });
  await formModelo.getByLabel("Código do modelo").fill("M01");
  await formModelo.getByLabel("Nome do modelo").fill("Modelo 01");
  await formModelo.getByLabel("Dado de exemplo (DEMO)").check();
  await formModelo.getByRole("button", { name: "Criar modelo" }).click();
  await expect(page.getByRole("heading", { name: "Modelo 01" })).toBeVisible();

  // Os campos do equipamento aparecem no modelo; número inválido é recusado.
  const caracteristicas = page.getByRole("region", { name: "Características técnicas" });
  await caracteristicas.getByLabel("Potência (kW)").fill("abc");
  await page.getByRole("button", { name: "Salvar modelo" }).click();
  await expect(page.getByText("Informe um número.")).toBeVisible();
  await expect(page.getByText("Campo obrigatório.")).toBeVisible();

  await caracteristicas.getByLabel("Potência (kW)").fill("1,5");
  await caracteristicas.getByLabel("Vazão (m³/h) *").fill("1000");
  await caracteristicas.getByLabel("Fases").selectOption("Trifásico");
  await caracteristicas.getByLabel("RS485").check();
  await page.getByRole("button", { name: "Salvar modelo" }).click();
  await expect(page.getByText("Modelo salvo.")).toBeVisible();
  await page.reload();
  await expect(caracteristicas.getByLabel("Potência (kW)")).toHaveValue("1,5");
  await expect(caracteristicas.getByLabel("RS485")).toBeChecked();

  // Imagem: SVG é recusado, PNG é aceito.
  await page.locator('input[name="arquivo"]').setInputFiles({
    name: "x.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  });
  await page.getByRole("button", { name: "Enviar imagem" }).click();
  await expect(page.getByText("Envie uma imagem JPG, PNG ou WebP.")).toBeVisible();
  await page.locator('input[name="arquivo"]').setInputFiles({ name: "modelo.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Enviar imagem" }).click();
  await expect(page.getByText("Imagem enviada.")).toBeVisible();
  const src = await page.locator('img[alt="Imagem"]').getAttribute("src");
  expect(src).toMatch(/^\/arquivos\/modelos\/.+\.png$/);
  const resposta = await page.request.get(src!);
  expect(resposta.status()).toBe(200);
  expect(resposta.headers()["content-type"]).toBe("image/png");

  // Duplicar, reordenar e inativar modelos.
  await page.getByRole("link", { name: "Exaustor" }).first().click();
  const modelos = page.getByRole("region", { name: "Modelos" });
  await modelos.getByRole("button", { name: "Duplicar" }).click();
  await expect(modelos.getByText("Modelo 01 (cópia)")).toBeVisible();
  await expect(modelos.getByText(/M01-COPIA/)).toBeVisible();
  await modelos.getByRole("button", { name: "Subir" }).nth(1).click();
  await expect(modelos.getByRole("link").first()).toContainText("Modelo 01 (cópia)");
  await modelos.getByRole("button", { name: "Inativar" }).first().click();
  await expect(modelos.getByText("Inativo")).toBeVisible();

  // Duplicar o equipamento copia campos e modelos.
  await page.getByRole("button", { name: "Duplicar" }).first().click();
  await expect(page.getByRole("heading", { name: "Exaustor (cópia)" })).toBeVisible();
  await expect(page.getByText("EXAUSTOR-DEMO-COPIA", { exact: false }).first()).toBeVisible();
  await page.getByRole("link", { name: /Modelos/ }).first().click();
  await expect(page.getByRole("region", { name: "Modelos" }).getByText("Modelo 01", { exact: true })).toBeVisible();

  // A lista mostra os dois, com selo DEMO.
  await page.goto("/admin/equipamentos");
  const lista = page.getByRole("region", { name: "Lista de equipamentos" });
  await expect(lista.getByText("Exaustores", { exact: false })).toBeVisible();
  await expect(lista.getByText("DEMO", { exact: true })).toHaveCount(2);
});
