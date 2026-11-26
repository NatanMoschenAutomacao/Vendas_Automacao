import { expect, test, type Page } from "@playwright/test";

// Roda depois de fase01 (troca a senha) e fase02 (cria o Exaustor DEMO com o Modelo 01).
async function entrarComoAdmin(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill("admin");
  await page.getByLabel("Senha").fill("NovaSenha2026");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

async function abrirPerguntasDoExaustor(page: Page) {
  await page.goto("/admin/equipamentos");
  await page.getByRole("region", { name: "Lista de equipamentos" }).getByRole("link", { name: /^Exaustor DEMO/ }).click();
  await page.getByRole("link", { name: "Perguntas", exact: true }).click();
}

test("Fase 03: perguntas, condição, ciclo, herança e pré-visualização", async ({ page }) => {
  await entrarComoAdmin(page);
  await abrirPerguntasDoExaustor(page);
  await expect(page.getByText("Nenhuma pergunta cadastrada para este equipamento.")).toBeVisible();

  // Pergunta 1: seleção única obrigatória.
  await page.getByRole("link", { name: "Nova pergunta" }).click();
  await page.getByLabel("Texto da pergunta").fill("Tipo de controle");
  await expect(page.getByLabel("Chave")).toHaveValue("tipo_de_controle");
  await page.getByLabel("Chave").fill("tipo_controle");
  await page.getByLabel("Resposta obrigatória").check();
  await page.getByRole("button", { name: "Adicionar opção" }).click();
  await page.getByLabel("Rótulo da opção 1").fill("Simultâneo");
  await page.getByRole("button", { name: "Adicionar opção" }).click();
  await page.getByLabel("Rótulo da opção 2").fill("Por grupos");
  await page.getByLabel("Valor da opção 2").fill("grupos");
  await page.getByRole("button", { name: "Salvar pergunta" }).click();
  await expect(page).toHaveURL(/aba=perguntas/);
  await expect(page.getByRole("region", { name: "Perguntas" }).getByText("Tipo de controle")).toBeVisible();

  // Pergunta 2: inteiro, exibida só quando o controle é por grupos.
  await page.getByRole("link", { name: "Nova pergunta" }).click();
  await page.getByLabel("Texto da pergunta").fill("Quantos grupos?");
  await page.getByLabel("Chave").fill("qtd_grupos");
  await page.getByLabel("Tipo de resposta").selectOption("INTEIRO");
  await page.getByLabel("Mínimo").fill("1");
  await page.getByLabel("Máximo").fill("10");
  await page.getByLabel("Exibir somente quando…").check();
  await page.getByLabel("Variável").selectOption("resposta.tipo_controle");
  await page.getByLabel("Operador").selectOption("igual");
  await page.getByLabel("Valor", { exact: true }).selectOption("grupos");
  await page.getByRole("button", { name: "Salvar pergunta" }).click();
  await expect(page).toHaveURL(/aba=perguntas/);
  const lista = page.getByRole("region", { name: "Perguntas" });
  await expect(lista.getByText("Exibir: Tipo de controle é igual a grupos")).toBeVisible();

  // Pré-visualização: a dependente aparece só com "Por grupos".
  const previa = page.getByRole("region", { name: "Pré-visualização" });
  await expect(previa.locator('[data-oculta="qtd_grupos"]')).toBeVisible();
  await expect(previa.getByText('Responda "Tipo de controle".')).toBeVisible();
  await previa.getByText("Por grupos").click();
  await expect(previa.locator('[data-pergunta="qtd_grupos"]')).toBeVisible();
  await previa.getByLabel(/Quantos grupos\?/).fill("20");
  await expect(previa.getByText("O máximo é 10.").first()).toBeVisible();
  await previa.getByLabel(/Quantos grupos\?/).fill("3");
  await expect(previa.getByText("Sem pendências.")).toBeVisible();
  await previa.getByText("Simultâneo").click();
  await expect(previa.locator('[data-oculta="qtd_grupos"]')).toBeVisible();

  // Ciclo: Tipo de controle passa a depender de Quantos grupos → recusado.
  await lista.getByRole("link", { name: /^Tipo de controle/ }).first().click();
  await page.getByLabel("Exibir somente quando…").check();
  await page.getByLabel("Variável").selectOption("resposta.qtd_grupos");
  await page.getByLabel("Operador").selectOption("preenchido");
  await page.getByRole("button", { name: "Salvar pergunta" }).click();
  await expect(page.getByText(/Referência circular: .*qtd_grupos.*tipo_controle|Referência circular: .*tipo_controle.*qtd_grupos/).first()).toBeVisible();

  // Herança: o Modelo 01 oculta "Quantos grupos?".
  await page.goto("/admin/equipamentos");
  await page.getByRole("region", { name: "Lista de equipamentos" }).getByRole("link", { name: /^Exaustor DEMO/ }).click();
  await page.getByRole("link", { name: /^Modelos/ }).click();
  await page.getByRole("region", { name: "Modelos" }).getByRole("link", { name: /^Modelo 01 DEMO/ }).click();
  await page.getByRole("link", { name: "Nova pergunta" }).click();
  await page.getByRole("combobox", { name: "Modo", exact: true }).selectOption("OCULTAR");
  await page.getByRole("combobox", { name: "Pergunta do equipamento", exact: true }).selectOption("qtd_grupos");
  await page.getByRole("button", { name: "Salvar pergunta" }).click();
  await expect(page.getByRole("region", { name: "Perguntas" }).getByText("Oculta")).toBeVisible();

  await abrirPerguntasDoExaustor(page);
  const previa2 = page.getByRole("region", { name: "Pré-visualização" });
  await previa2.getByLabel("Modelo simulado").selectOption({ label: "Modelo 01" });
  await previa2.getByText("Por grupos").click();
  await expect(previa2.locator('[data-pergunta="qtd_grupos"]')).toHaveCount(0);
  await expect(previa2.locator('[data-oculta="qtd_grupos"]')).toHaveCount(0);
});
