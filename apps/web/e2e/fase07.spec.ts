import { expect, test, type Page } from "@playwright/test";

// Roda depois da fase06: Granja Exemplo com o grupo "Exaustores" (Temperatura) no painel QC-01 (220 V)
// e a regra EXA-DO (1 DO por acionamento, 4 no total).

async function entrar(page: Page, usuario: string, senha: string, destino: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(usuario);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(destino);
}

async function criarItem(page: Page, codigo: string, descricao: string) {
  await page.goto("/admin/componentes");
  const novo = page.getByRole("form", { name: "Novo item" });
  await novo.getByLabel("Código interno").fill(codigo);
  await novo.getByLabel("Descrição").fill(descricao);
  await novo.getByLabel("Dado de demonstração (DEMO)").check();
  await novo.getByRole("button", { name: "Criar item" }).click();
  await expect(page.getByText(`Item ${codigo} criado.`)).toBeVisible();
}

async function criarControlador(page: Page, rotuloDoItem: string, opcoes: { saidas: [string, string[]][]; do: number; tensoes?: string; modelo?: RegExp }) {
  await page.goto("/admin/controladores");
  const novo = page.getByRole("form", { name: "Novo controlador" });
  await novo.getByRole("combobox", { name: "Item do catálogo", exact: true }).selectOption({ label: rotuloDoItem });
  await novo.getByRole("button", { name: "Criar controlador" }).click();
  await expect(page.getByRole("heading", { name: "Dados técnicos" })).toBeVisible();

  if (opcoes.tensoes) {
    const dados = page.getByRole("form", { name: "Dados do controlador" });
    await dados.getByLabel("Tensões aceitas (V)").fill(opcoes.tensoes);
    await dados.getByRole("button", { name: "Salvar controlador" }).click();
    await expect(page.getByText("Controlador salvo.")).toBeVisible();
  }

  const saidas = page.getByRole("group", { name: "Saídas funcionais" });
  for (const [n, [, funcoes]] of opcoes.saidas.entries()) {
    await saidas.getByRole("button", { name: "Adicionar saída" }).click();
    for (const f of funcoes) await saidas.locator(`[data-saida="${n}"]`).getByLabel(f).check();
  }
  await saidas.getByRole("button", { name: "Salvar saídas" }).click();
  await expect(page.getByText("Saídas funcionais salvas.")).toBeVisible();

  const recursos = page.getByRole("group", { name: "Recursos integrados" });
  await recursos.getByLabel("DO integradas").fill(String(opcoes.do));
  await recursos.getByRole("button", { name: "Salvar recursos" }).click();
  await expect(page.getByText("Recursos salvos.")).toBeVisible();

  if (opcoes.modelo) {
    const modelos = page.getByRole("form", { name: "Modelos compatíveis" });
    await modelos.getByRole("group", { name: "Exaustor", exact: true }).getByLabel(opcoes.modelo).check();
    await modelos.getByRole("button", { name: "Salvar compatibilidade" }).click();
    await expect(page.getByText("1 modelo(s) compatível(is).")).toBeVisible();
  }
}

test("Fase 07: controladores, saídas funcionais, recursos por controlador e compatibilidade", async ({ page }) => {
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);

  await page.goto("/admin/funcoes-de-controle");
  await page.getByLabel("Código").fill("umidade");
  await page.getByLabel("Nome", { exact: true }).fill("Umidade");
  await page.getByRole("button", { name: "Criar função de controle" }).click();
  await expect(page.getByRole("region", { name: "Funções de controle" }).getByText("Umidade", { exact: true })).toBeVisible();

  await criarItem(page, "CTRL-A", "Controlador DEMO A");
  await criarItem(page, "CTRL-B", "Controlador DEMO B");

  // A: 2 DO integradas, 220 V, compatível só com o Modelo 01. B: 8 DO, sem lista de modelos.
  await criarControlador(page, "CTRL-A — Controlador DEMO A", {
    saidas: [
      ["SP1", ["Temperatura", "Umidade"]],
      ["SP2", ["Temperatura"]],
    ],
    do: 2,
    tensoes: "220",
    modelo: /^Modelo 01 M01$/,
  });
  await criarControlador(page, "CTRL-B — Controlador DEMO B", { saidas: [["SP1", ["Temperatura"]]], do: 8 });
  await page.goto("/admin/controladores");
  const lista = page.getByRole("region", { name: "Lista de controladores" });
  await expect(lista.getByText(/2 saída\(s\) funcional\(is\) · 2 DO · 1 modelo/)).toBeVisible();

  // ───────── Vendedor ─────────
  await page.context().clearCookies();
  await entrar(page, "vendedor1", "Vendedor2026", /\/$/);
  await page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Granja Exemplo/ }).click();
  await page.getByRole("button", { name: "Controladores", exact: true }).click();
  await page.getByLabel("Nome do novo controlador").fill("Controlador do galpão");
  await page.getByLabel("Nome do novo controlador").press("Enter");
  const card = page.getByRole("region", { name: "Controlador Controlador do galpão" });
  await expect(card.getByRole("combobox", { name: "Painel do controlador", exact: true })).toHaveValue(/.+/);
  await expect(page.getByRole("region", { name: "Pendências" }).getByText("Escolha o modelo do controlador Controlador do galpão.")).toBeVisible();

  // O grupo de 4 exaustores consome 1 saída funcional, mas 4 DO: o A (2 DO) deixa de ser compatível.
  await card.getByLabel(/^Exaustores/).check();
  const modelo = card.getByRole("combobox", { name: "Modelo do controlador", exact: true });
  await modelo.selectOption({ label: "Controlador DEMO A (incompatível)" });
  await expect(card.locator('[data-status="erro"]')).toBeVisible();
  await expect(card.getByText("Faltam 2 DO (precisa 4, tem 2).")).toBeVisible();
  await expect(page.getByRole("region", { name: "Pendências" }).getByText(/Controlador do galpão \(Controlador DEMO A\): Faltam 2 DO/)).toBeVisible();

  // O B atende: distribuição automática e recursos somados só deste controlador.
  await modelo.selectOption({ label: "✓ Controlador DEMO B" });
  await expect(card.locator('[data-status="ok"]')).toBeVisible();
  await expect(card.locator('tr[data-grupo="Exaustores"]')).toHaveAttribute("data-saida", "SP1");
  await expect(card.locator('tr[data-recurso="DO"] [data-campo="necessario"]')).toHaveText("4");
  await expect(page.getByRole("region", { name: "Pendências" }).getByText(/não tem lista de modelos compatíveis/)).toBeVisible();

  // O controlador escolhido entra na lista de materiais.
  await page.getByRole("button", { name: "Materiais e I/O" }).click();
  await expect(page.getByRole("region", { name: "Lista de materiais" }).locator('tr[data-codigo="CTRL-B"]')).toHaveAttribute("data-quantidade", "1");

  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Controladores", exact: true }).click();
  await expect(page.getByRole("region", { name: "Controlador Controlador do galpão" }).locator('[data-status="ok"]')).toBeVisible();
});
