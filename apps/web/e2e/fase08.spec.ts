import { expect, test, type Page } from "@playwright/test";

// Roda depois da fase07: "Controlador do galpão" na Granja Exemplo, com o grupo Exaustores (4 DO).

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

async function criarCartao(page: Page, rotulo: string, pontosDO: number, barramento: string) {
  await page.goto("/admin/cartoes");
  const novo = page.getByRole("form", { name: "Novo cartão" });
  await novo.getByRole("combobox", { name: "Item do catálogo", exact: true }).selectOption({ label: rotulo });
  await novo.getByRole("button", { name: "Criar cartão" }).click();
  const dados = page.getByRole("form", { name: "Dados do cartão" });
  await dados.getByLabel("Barramento", { exact: true }).fill(barramento);
  await dados.getByLabel("Consumo no barramento (mA)").fill("50");
  await dados.getByRole("button", { name: "Salvar cartão" }).click();
  await expect(page.getByText("Cartão salvo.")).toBeVisible();
  const pontos = page.getByRole("group", { name: "Pontos do cartão" });
  await pontos.getByLabel("DO no cartão").fill(String(pontosDO));
  await pontos.getByRole("button", { name: "Salvar recursos" }).click();
  await expect(page.getByText("Pontos do cartão salvos.")).toBeVisible();
  const compat = page.getByRole("form", { name: "Controladores compatíveis" });
  await compat.getByLabel(/CLP DEMO/).check();
  await compat.getByRole("button", { name: "Salvar compatibilidade" }).click();
  await expect(page.getByText("1 controlador(es) compatível(is).")).toBeVisible();
}

const linha = (page: Page, codigo: string) => page.getByRole("region", { name: "Lista de materiais" }).locator(`tr[data-codigo="${codigo}"]`);

test("Fase 08: reserva técnica, CLP, cartões compatíveis e escolha de combinação", async ({ page }) => {
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);

  // Reserva padrão: 50% de DO.
  await page.goto("/admin/configuracoes");
  const reserva = page.getByRole("form", { name: "Reserva técnica padrão" });
  await reserva.getByRole("combobox", { name: "Modo da reserva", exact: true }).selectOption("percentual");
  await reserva.getByLabel("Reserva de DO").fill("50");
  await reserva.getByRole("button", { name: "Salvar reserva" }).click();
  await expect(page.getByText("Reserva técnica padrão salva.")).toBeVisible();

  await criarItem(page, "CLP-1", "CLP DEMO");
  await criarItem(page, "CART-DO8", "Cartão 8 DO DEMO");
  await criarItem(page, "CART-DO2", "Cartão 2 DO DEMO");
  await criarItem(page, "CART-X", "Cartão de outro barramento DEMO");

  // CLP: 2 DO integradas, barramento B1, até 2 módulos, SP1 de temperatura.
  await page.goto("/admin/controladores");
  const novo = page.getByRole("form", { name: "Novo controlador" });
  await novo.getByRole("combobox", { name: "Item do catálogo", exact: true }).selectOption({ label: "CLP-1 — CLP DEMO" });
  await novo.getByRole("combobox", { name: "Tipo de controlador", exact: true }).selectOption("CLP");
  await novo.getByRole("button", { name: "Criar controlador" }).click();
  const dados = page.getByRole("form", { name: "Dados do controlador" });
  await dados.getByLabel("Barramento", { exact: true }).fill("B1");
  await dados.getByLabel("Máximo de módulos").fill("2");
  await dados.getByRole("button", { name: "Salvar controlador" }).click();
  await expect(page.getByText("Controlador salvo.")).toBeVisible();
  const saidas = page.getByRole("group", { name: "Saídas funcionais" });
  await saidas.getByRole("button", { name: "Adicionar saída" }).click();
  await saidas.locator('[data-saida="0"]').getByLabel("Temperatura").check();
  await saidas.getByRole("button", { name: "Salvar saídas" }).click();
  await expect(page.getByText("Saídas funcionais salvas.")).toBeVisible();
  const recursos = page.getByRole("group", { name: "Recursos integrados" });
  await recursos.getByLabel("DO integradas").fill("2");
  await recursos.getByRole("button", { name: "Salvar recursos" }).click();
  await expect(page.getByText("Recursos salvos.")).toBeVisible();

  await criarCartao(page, "CART-DO8 — Cartão 8 DO DEMO", 8, "B1");
  await criarCartao(page, "CART-DO2 — Cartão 2 DO DEMO", 2, "B1");
  await criarCartao(page, "CART-X — Cartão de outro barramento DEMO", 16, "B2");

  // ───────── Vendedor ─────────
  await page.context().clearCookies();
  await entrar(page, "vendedor1", "Vendedor2026", /\/$/);
  await page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Granja Exemplo/ }).click();
  await page.getByRole("button", { name: "Controladores", exact: true }).click();
  await expect(page.getByRole("group", { name: "Reserva técnica do projeto" })).toContainText("DO 50%");
  await expect(page.getByLabel("Modo da reserva do projeto")).toHaveCount(0);
  const card = page.getByRole("region", { name: "Controlador Controlador do galpão" });
  await card.getByRole("combobox", { name: "Modelo do controlador", exact: true }).selectOption({ label: "✓ CLP DEMO" });

  // Cenário 10: 4 DO + 2 de reserva − 2 integradas = 4 por expansão.
  const doLinha = card.locator('tr[data-recurso="DO"]');
  await expect(doLinha.locator('[data-campo="reserva"]')).toHaveText("2");
  await expect(doLinha.locator('[data-campo="deficit"]')).toHaveText("4");

  // Cenário 11: duas combinações (1× 8 DO ou 2× 2 DO); o cartão de outro barramento não aparece (cenário 12).
  const cartoes = card.getByRole("group", { name: "Cartões de Controlador do galpão" });
  await expect(cartoes.locator("[data-alternativa]")).toHaveCount(2);
  await expect(cartoes).not.toContainText("outro barramento");
  await expect(page.getByRole("region", { name: "Pendências" }).getByText("Escolha uma das 2 combinações de cartões de Controlador do galpão.")).toBeVisible();
  await cartoes.getByRole("button", { name: "Escolher opção 2" }).click();
  await expect(cartoes.locator('[data-alternativa="2"]')).toHaveAttribute("data-escolhida", "sim");
  await expect(page.getByText("Escolha uma das 2 combinações de cartões de Controlador do galpão.")).toHaveCount(0);

  await page.getByRole("button", { name: "Materiais e I/O" }).click();
  await expect(linha(page, "CART-DO2")).toHaveAttribute("data-quantidade", "2");
  await expect(linha(page, "CLP-1")).toHaveAttribute("data-quantidade", "1");
  await expect(linha(page, "CART-X")).toHaveCount(0);
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();

  // ───────── Administrador ajusta a reserva do projeto ─────────
  await page.context().clearCookies();
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);
  await page.goto("/");
  await page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Granja Exemplo/ }).click();
  await page.getByRole("button", { name: "Controladores", exact: true }).click();
  await page.getByRole("combobox", { name: "Modo da reserva do projeto", exact: true }).selectOption("nenhuma");
  // Sem reserva faltam 2 DO: 1× cartão de 2 DO é a única opção e é escolhida sozinha; a escolha antiga é descartada com aviso.
  const card2 = page.getByRole("region", { name: "Controlador Controlador do galpão" });
  await expect(card2.locator('tr[data-recurso="DO"] [data-campo="deficit"]')).toHaveText("2");
  await expect(card2.getByText("Única opção, escolhida sozinha")).toBeVisible();
  await expect(page.getByRole("region", { name: "Pendências" }).getByText(/combinação de cartões escolhida .* foi descartada/)).toBeVisible();
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Controladores", exact: true }).click();
  await expect(page.getByRole("group", { name: "Reserva técnica do projeto" })).toContainText("ajustada neste projeto");
});
