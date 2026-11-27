import { expect, test, type Page } from "@playwright/test";

// Roda depois da fase08: a Granja Exemplo tem o CLP DEMO (CLP-1) e outros itens ainda sem preço.
// Todos os preços, serviços e impostos abaixo são DEMO, criados só para o teste.

async function entrar(page: Page, usuario: string, senha: string, destino: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(usuario);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(destino);
}

async function abrirGranja(page: Page) {
  await page.goto("/");
  await page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Granja Exemplo/ }).click();
  await page.getByRole("button", { name: "Preços", exact: true }).click();
}

test("Fase 09: preços com histórico, serviços, regra comercial, impostos, descontos e custos ocultos", async ({ page }) => {
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);

  // Regra comercial: markup de 50% (equivale a margem de 33,33%).
  await page.goto("/admin/configuracoes");
  const regra = page.getByRole("form", { name: "Regra comercial" });
  await regra.getByRole("combobox", { name: "Tipo da regra", exact: true }).selectOption("markup");
  await regra.getByLabel("Percentual da regra").fill("50");
  await expect(regra.locator('[data-campo="equivalencia"]')).toContainText("equivale a margem de 33,33%");
  await regra.getByRole("button", { name: "Salvar regra comercial" }).click();
  await expect(page.getByText("Regra comercial salva.")).toBeVisible();

  const impostos = page.getByRole("group", { name: "Impostos" });
  await impostos.getByRole("button", { name: "Adicionar imposto" }).click();
  await impostos.getByLabel("Nome do imposto 1").fill("Imposto DEMO serviço");
  await impostos.getByRole("combobox", { name: "Grupo do imposto 1", exact: true }).selectOption("servico");
  await impostos.getByLabel("Percentual do imposto 1").fill("5");
  await impostos.getByRole("button", { name: "Salvar impostos" }).click();
  await expect(page.getByText("Impostos salvos.")).toBeVisible();

  const limite = page.getByRole("form", { name: "Limite de desconto do vendedor" });
  await limite.getByLabel("Limite de desconto do vendedor (%)").fill("5");
  await limite.getByRole("button", { name: "Salvar limite" }).click();
  await expect(page.getByText("Limite de desconto salvo.")).toBeVisible();

  // Preço do CLP: custo + regra, custo R$ 1.000,00 → venda R$ 1.500,00.
  await page.goto("/admin/precos?filtro=sem-preco");
  await page.getByRole("region", { name: "Preços vigentes" }).getByRole("link", { name: "CLP DEMO" }).click();
  const precos = page.getByRole("region", { name: "Preços do item" });
  await expect(precos.locator('[data-campo="venda-vigente"]')).toContainText("Sem preço vigente");
  const novoPreco = precos.getByRole("form", { name: "Novo preço" });
  await novoPreco.getByRole("combobox", { name: "Modo de preço", exact: true }).selectOption("custo_regra");
  await expect(novoPreco.getByLabel("Venda (R$)")).toHaveCount(0);
  await novoPreco.getByLabel("Custo (R$)").fill("1.000,00");
  await novoPreco.getByRole("button", { name: "Registrar preço" }).click();
  await expect(page.getByText("Preço registrado.")).toBeVisible();
  await expect(precos.locator('[data-campo="venda-vigente"]')).toContainText(/1\.500,00/);
  await expect(precos.getByLabel("Histórico de preços").getByText("Vigente")).toBeVisible();
  await page.goto("/admin/precos");
  await expect(page.locator('tr[data-codigo="CLP-1"] [data-campo="venda"]')).toContainText(/1\.500,00/);

  // Serviço de programação: R$ 150,00 por hora.
  await page.goto("/admin/servicos");
  const novoServico = page.getByRole("form", { name: "Novo serviço" });
  await novoServico.getByLabel("Código").fill("SRV-PROG");
  await novoServico.getByLabel("Descrição").fill("Programação DEMO");
  await novoServico.getByLabel("Valor de venda (R$)").fill("150");
  await novoServico.getByLabel("Custo (R$)").fill("90");
  await novoServico.getByLabel("Dado de demonstração (DEMO)").check();
  await novoServico.getByRole("button", { name: "Criar serviço" }).click();
  await expect(page.getByRole("form", { name: "Dados do serviço" })).toBeVisible();

  // ───────── Vendedor ─────────
  await page.context().clearCookies();
  await entrar(page, "vendedor1", "Vendedor2026", /\/$/);
  await abrirGranja(page);
  // O navegador do vendedor nunca recebe custo: nem na tela nem nos dados da página.
  expect(await page.content()).not.toMatch(/custo\\?"\s*:\s*\\?"1000/);
  const tabela = page.getByRole("region", { name: "Preços por linha" });
  await expect(tabela.getByRole("columnheader", { name: "Custo total" })).toHaveCount(0);
  await expect(tabela.locator('tr[data-codigo="CLP-1"]')).toHaveAttribute("data-total", "1500.00");
  // Cenário 15: itens sem preço deixam o total parcial e geram pendência impeditiva.
  await expect(tabela.locator("tr[data-sem-preco]").first()).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "Os totais abaixo são parciais" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Totais" }).getByText("Total geral (parcial)")).toBeVisible();
  await expect(page.getByRole("region", { name: "Pendências" }).getByText(/está sem preço vigente/).first()).toBeVisible();

  // Serviço avulso: 2 h × R$ 150,00 = R$ 300,00; imposto DEMO de 5% → R$ 315,00.
  const incluir = page.getByRole("group", { name: "Incluir serviço" });
  await incluir.getByRole("combobox", { name: "Serviço", exact: true }).selectOption({ label: "SRV-PROG — Programação DEMO (h)" });
  await incluir.getByLabel("Quantidade do serviço").fill("2");
  await incluir.getByRole("button", { name: "Incluir serviço" }).click();
  await expect(tabela.locator('tr[data-codigo="SRV-PROG"]')).toHaveAttribute("data-total", "300.00");
  const totalServicos = page.getByRole("region", { name: "Totais" }).locator('[data-grupo="servico"] [data-campo="total-do-grupo"]');
  await expect(totalServicos).toContainText(/315,00/);

  // Limite do vendedor: 10% é recusado; 3% nos serviços é aceito. Desconto em valor não é oferecido.
  const ajuste = page.getByRole("group", { name: "Novo desconto ou acréscimo" });
  await expect(ajuste.getByRole("combobox", { name: "Forma do ajuste", exact: true })).toBeDisabled();
  await ajuste.getByLabel("Valor do ajuste").fill("10");
  await ajuste.getByLabel("Justificativa do ajuste").fill("Cliente antigo");
  await ajuste.getByRole("button", { name: "Aplicar ajuste comercial" }).click();
  await expect(ajuste.getByText(/passa do seu limite de 5%/)).toBeVisible();
  await ajuste.getByRole("combobox", { name: "Aplicar sobre", exact: true }).selectOption("servico");
  await ajuste.getByLabel("Valor do ajuste").fill("3");
  await ajuste.getByRole("button", { name: "Aplicar ajuste comercial" }).click();
  await expect(page.locator("[data-ajuste-comercial]")).toHaveCount(1);
  // 300 − 3% (9,00) = 291,00; imposto 5% = 14,55 → 305,55.
  await expect(totalServicos).toContainText(/305,55/);

  await page.getByRole("region", { name: "Condições comerciais" }).getByLabel("Garantia").fill("12 meses DEMO");
  await page.getByRole("region", { name: "Condições comerciais" }).getByLabel("Prazo de entrega").click();
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Preços", exact: true }).click();
  await expect(page.getByRole("region", { name: "Totais" }).locator('[data-grupo="servico"] [data-campo="total-do-grupo"]')).toContainText(/305,55/);
  await expect(page.locator("[data-ajuste-comercial]")).toContainText("Vendedor");
  await expect(page.getByRole("region", { name: "Condições comerciais" }).getByLabel("Garantia")).toHaveValue("12 meses DEMO");

  // ───────── Administrador vê custo e margem ─────────
  await page.context().clearCookies();
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);
  await abrirGranja(page);
  await expect(page.getByRole("region", { name: "Preços por linha" }).getByRole("columnheader", { name: "Custo total" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Preços por linha" }).locator('tr[data-codigo="CLP-1"]')).toContainText("Custo + regra comercial");
  await expect(page.locator('[data-campo="margem"]')).toBeVisible();
});
