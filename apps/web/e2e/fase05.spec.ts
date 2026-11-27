import { expect, test, type Page } from "@playwright/test";

// Roda depois da fase04: usa o orçamento "Granja Exemplo" (2+1 sensores de chuva e 4 exaustores).

async function entrar(page: Page, usuario: string, senha: string, destino: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(usuario);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(destino);
}

const total = (page: Page, nome: string) => page.locator(`[data-total="${nome}"] dd`).first();

test("Fase 05: ambientes, setores, painéis, acionamentos, proteções e grupos", async ({ page }) => {
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);

  // Cadastros da estrutura (DEMO).
  await page.goto("/admin/tipos-de-painel");
  await page.getByLabel("Nome", { exact: true }).fill("Controle");
  await page.getByLabel("Dado de demonstração (DEMO)").check();
  await page.getByRole("button", { name: "Criar tipo de painel" }).click();
  await expect(page.getByRole("region", { name: "Tipos de painel" }).getByText("Controle", { exact: true })).toBeVisible();

  await page.goto("/admin/funcoes-de-controle");
  await page.getByLabel("Código").fill("Temp!");
  await page.getByLabel("Nome", { exact: true }).fill("Temperatura");
  await page.getByRole("button", { name: "Criar função de controle" }).click();
  await expect(page.getByText(/Use letras minúsculas/)).toBeVisible();
  await page.getByLabel("Código").fill("temperatura");
  await page.getByRole("button", { name: "Criar função de controle" }).click();
  await expect(page.getByRole("region", { name: "Funções de controle" }).getByText("Temperatura", { exact: true })).toBeVisible();

  // Regras do Exaustor DEMO: acionamento individual, proteção coletiva a cada 4.
  await page.goto("/admin/equipamentos");
  await page.getByRole("region", { name: "Lista de equipamentos" }).getByRole("link", { name: /^Exaustor DEMO/ }).click();
  await page.getByRole("link", { name: "Acionamento e proteção" }).click();
  const regras = page.getByRole("form", { name: "Acionamento e proteção" });
  await regras.getByRole("combobox", { name: "Acionamento", exact: true }).selectOption("INDIVIDUAL");
  await regras.getByRole("combobox", { name: "Proteção", exact: true }).selectOption("COLETIVO");
  await regras.getByLabel("Unidades por proteção").fill("4");
  await regras.getByRole("button", { name: "Salvar regras" }).click();
  await expect(page.getByText("Regras salvas.")).toBeVisible();

  // ───────── Vendedor ─────────
  await page.context().clearCookies();
  await entrar(page, "vendedor1", "Vendedor2026", /\/$/);
  await page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Granja Exemplo/ }).click();
  await expect(total(page, "Equipamentos")).toHaveText("7");
  await expect(total(page, "Acionamentos")).toHaveText("4");
  await expect(total(page, "Proteções")).toHaveText("1");

  // Ambientes, setor e painel.
  await page.getByRole("button", { name: "Ambientes e painéis" }).click();
  const ambientes = page.getByRole("region", { name: "Ambientes e setores" });
  await ambientes.getByLabel("Nome do novo ambiente").fill("Galpão 1");
  await ambientes.getByRole("button", { name: "Ambiente" }).click();
  await ambientes.getByLabel("Nome do novo ambiente").fill("Galpão 2");
  await ambientes.getByLabel("Nome do novo ambiente").press("Enter");
  await ambientes.getByLabel("Novo setor em Galpão 1").fill("Setor A");
  await ambientes.getByRole("button", { name: "Setor" }).first().click();
  await expect(total(page, "Ambientes")).toHaveText("2");
  await expect(total(page, "Setores")).toHaveText("1");

  const paineis = page.getByRole("region", { name: "Painéis" });
  await paineis.getByLabel("Identificação do novo painel").fill("QC-01");
  await paineis.getByRole("button", { name: "Painel" }).click();
  await expect(page.getByRole("region", { name: "Pendências" }).getByText('Escolha o tipo do painel "QC-01".')).toBeVisible();
  await paineis.getByLabel("Tipo de painel").selectOption({ label: "Controle" });
  await paineis.getByLabel("Tensão (V)").fill("220");
  await paineis.getByLabel("Galpão 1").check();
  await paineis.getByLabel("Galpão 2").check();
  await expect(page.getByText('Escolha o tipo do painel "QC-01".')).toHaveCount(0);

  // O exaustor atende os dois galpões: aparece em cada um, contado uma vez (cenário 09).
  await page.getByRole("button", { name: "Equipamentos", exact: true }).click();
  const projeto = page.getByRole("list", { name: "Itens do projeto" });
  await projeto.getByRole("button", { name: /4× Exaustor/ }).click();
  const painel = page.getByRole("region", { name: "Configuração de Exaustor" });
  await painel.getByLabel("Galpão 1").check();
  await painel.getByLabel("Galpão 2").check();
  await expect(painel.getByText("Compartilhado")).toBeVisible();
  await painel.getByRole("combobox", { name: "Setor", exact: true }).selectOption({ label: "Galpão 1 › Setor A" });
  await painel.getByRole("combobox", { name: "Painel", exact: true }).selectOption({ label: "QC-01" });
  await expect(total(page, "Equipamentos")).toHaveText("7");
  await expect(page.getByText("1 item(ns) compartilhado(s)")).toBeVisible();
  await page.getByRole("button", { name: "Ambientes e painéis" }).click();
  await expect(ambientes.locator('[data-ambiente="Galpão 2"]').getByText(/4× Exaustor \(compartilhado\)/)).toBeVisible();

  // Grupo de controle com função; excesso de unidades vira pendência impeditiva.
  await page.getByRole("button", { name: "Grupos de controle" }).click();
  const grupos = page.getByRole("region", { name: "Grupos de controle" });
  await grupos.getByLabel("Nome do novo grupo").fill("Exaustores");
  await grupos.getByRole("button", { name: "Grupo" }).click();
  await grupos.getByLabel("Função de controle").selectOption({ label: "Temperatura" });
  await grupos.getByLabel("Unidades de Exaustor em Exaustores").fill("5");
  await expect(page.getByRole("region", { name: "Pendências" }).getByText("Os grupos usam 5 unidade(s), mas o item tem 4.")).toBeVisible();
  await grupos.getByLabel("Unidades de Exaustor em Exaustores").fill("4");
  await expect(page.getByText("Os grupos usam 5 unidade(s), mas o item tem 4.")).toHaveCount(0);
  await expect(total(page, "Grupos de controle")).toHaveText("1");
  // Grupos não mudam acionamentos nem proteções (§18).
  await expect(total(page, "Acionamentos")).toHaveText("4");
  await expect(total(page, "Proteções")).toHaveText("1");

  // Tudo persiste no rascunho.
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
  await page.reload();
  await expect(total(page, "Ambientes")).toHaveText("2");
  await expect(total(page, "Painéis")).toHaveText("1");
  await expect(total(page, "Grupos de controle")).toHaveText("1");
  await page.getByRole("button", { name: "Grupos de controle" }).click();
  await expect(page.getByRole("region", { name: "Grupos de controle" }).getByLabel("Unidades de Exaustor em Exaustores")).toHaveValue("4");
});
