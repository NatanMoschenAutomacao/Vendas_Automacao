import { expect, test, type Page } from "@playwright/test";

// Roda depois de fase01 (senhas), fase02 (Exaustor DEMO + Modelo 01) e fase03 (perguntas do Exaustor).
// A estação meteorológica é cadastrada pela interface, como pede o planejamento.

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function entrar(page: Page, usuario: string, senha: string, destino: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(usuario);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(destino);
}

async function criarEquipamentoComModelo(page: Page, codigo: string, nome: string, tipo: string, modelo: string) {
  await page.goto("/admin/equipamentos");
  await page.getByLabel("Código").fill(codigo);
  await page.getByLabel("Nome do equipamento").fill(nome);
  await page.getByRole("combobox", { name: "Tipo", exact: true }).selectOption(tipo);
  await page.getByLabel("Categoria").selectOption({ label: "— Estação meteorológica" });
  await page.getByLabel("Dado de exemplo (DEMO)").check();
  await page.getByRole("button", { name: "Criar equipamento" }).click();
  await expect(page).toHaveURL(/aba=caracteristicas/);
  await page.getByRole("link", { name: /Modelos/ }).first().click();
  const form = page.getByRole("form", { name: "Novo modelo" });
  await form.getByLabel("Código do modelo").fill(`${codigo}-M1`);
  await form.getByLabel("Nome do modelo").fill(modelo);
  await form.getByLabel("Dado de exemplo (DEMO)").check();
  await form.getByRole("button", { name: "Criar modelo" }).click();
  await expect(page.getByRole("heading", { name: modelo })).toBeVisible();
}

test("Fase 04: kits, imagens interativas e configurador do vendedor", async ({ page }) => {
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);

  // Estação meteorológica e sensor cadastrados pela interface (DEMO).
  await criarEquipamentoComModelo(page, "estacao-demo", "Estação meteorológica", "EQUIPAMENTO", "Estação DEMO");
  await criarEquipamentoComModelo(page, "chuva-demo", "Sensor de chuva", "SENSOR", "Sensor de chuva DEMO");

  // Kit "Estação completa": 1 estação + 2 sensores de chuva.
  await page.goto("/admin/kits");
  await expect(page.getByText("Nenhum kit cadastrado.")).toBeVisible();
  await page.getByLabel("Nome", { exact: true }).fill("Estação completa");
  await page.getByLabel("Categoria ou sistema").selectOption({ label: "— Estação meteorológica" });
  await page.getByLabel("Dado de demonstração (DEMO)").check();
  await page.getByRole("button", { name: "Criar kit" }).click();
  await expect(page.getByRole("heading", { name: "Estação completa" })).toBeVisible();
  const itens = page.getByRole("region", { name: "Itens do kit" });
  await itens.getByRole("button", { name: "Adicionar item" }).click();
  await itens.getByLabel("Equipamento do item 1").selectOption({ label: "Estação meteorológica" });
  await itens.getByRole("button", { name: "Adicionar item" }).click();
  await itens.getByLabel("Equipamento do item 2").selectOption({ label: "Sensor de chuva" });
  await itens.getByLabel("Quantidade do item 2").fill("2");
  await itens.getByRole("button", { name: "Salvar itens" }).click();
  await expect(page.getByText("Itens salvos.")).toBeVisible();
  await page.reload();
  await expect(itens.getByLabel("Quantidade do item 2")).toHaveValue("2");

  // Imagem interativa do sistema, com área que adiciona o sensor de chuva.
  await page.goto("/admin/imagens-interativas");
  await page.getByLabel("Nome", { exact: true }).fill("Vista da estação");
  await page.getByLabel("Onde aparece").selectOption({ label: "— Estação meteorológica" });
  await page.locator('input[name="arquivo"]').setInputFiles({ name: "estacao.png", mimeType: "image/png", buffer: PNG });
  await page.getByLabel("Dado de demonstração (DEMO)").check();
  await page.getByRole("button", { name: "Enviar e editar áreas" }).click();
  await expect(page.getByRole("heading", { name: "Vista da estação" })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar área" }).click();
  const area = page.getByRole("group", { name: "Área selecionada" });
  await area.getByLabel("Rótulo").fill("Sensor de chuva");
  await area.getByLabel("Ao clicar").selectOption("EQUIPAMENTO");
  await area.getByRole("combobox", { name: "Alvo", exact: true }).selectOption({ label: "Sensor de chuva" });
  await page.getByRole("button", { name: "Salvar áreas" }).click();
  await expect(page.getByText("Áreas salvas.")).toBeVisible();

  // Imagem do Exaustor com área de opção: marca "Por grupos" em Tipo de controle.
  await page.goto("/admin/imagens-interativas");
  await page.getByLabel("Nome", { exact: true }).fill("Painel do exaustor");
  await page.getByLabel("Onde aparece").selectOption({ label: "Exaustor" });
  await page.locator('input[name="arquivo"]').setInputFiles({ name: "exaustor.png", mimeType: "image/png", buffer: PNG });
  await page.getByRole("button", { name: "Enviar e editar áreas" }).click();
  await expect(page.getByRole("heading", { name: "Painel do exaustor" })).toBeVisible();
  await page.getByRole("button", { name: "Adicionar área" }).click();
  await area.getByLabel("Rótulo").fill("Controle por grupos");
  await area.getByLabel("Ao clicar").selectOption("OPCAO");
  await area.getByRole("combobox", { name: "Alvo", exact: true }).selectOption({ label: "Tipo de controle" });
  await area.getByRole("combobox", { name: "Opção", exact: true }).selectOption({ label: "Por grupos" });
  await page.getByRole("button", { name: "Salvar áreas" }).click();
  await expect(page.getByText("Áreas salvas.")).toBeVisible();

  // ───────── Vendedor ─────────
  await page.context().clearCookies();
  await entrar(page, "vendedor1", "Vendedor2026", /\/$/);
  await expect(page.getByText("Nenhum orçamento ainda")).toBeVisible();
  await page.getByRole("link", { name: "Novo orçamento" }).click();
  // O servidor valida mesmo o que o navegador deixou passar.
  await page.getByLabel("Cliente").fill("A");
  await page.getByLabel("Projeto").fill("Aviário 3");
  await page.getByRole("button", { name: "Criar e configurar" }).click();
  await expect(page.getByText("Informe o cliente.")).toBeVisible();
  await page.getByLabel("Cliente").fill("Granja Exemplo");
  await page.getByLabel("Projeto").fill("Aviário 3");
  await page.getByLabel("Cidade").fill("Chapecó");
  await page.getByLabel("UF").selectOption("SC");
  await page.getByRole("button", { name: "Criar e configurar" }).click();
  await expect(page.getByRole("heading", { name: "Granja Exemplo · Aviário 3" })).toBeVisible();
  await expect(page.getByText(/Orçamento \d{4}-0001/)).toBeVisible();

  // Catálogo: Monitoramento › Estação meteorológica.
  const catalogo = page.getByRole("region", { name: "Catálogo" });
  await catalogo.getByRole("button", { name: /^Monitoramento/ }).click();
  await catalogo.getByRole("button", { name: /^Estação meteorológica/ }).click();
  await expect(catalogo.getByRole("heading", { name: "Estação completa" })).toBeVisible();

  // Kit (estação completa) e seleção pela imagem (estação personalizada).
  await catalogo.getByRole("button", { name: "Aplicar Estação completa" }).click();
  const projeto = page.getByRole("list", { name: "Itens do projeto" });
  await expect(projeto.getByText("1× Estação meteorológica")).toBeVisible();
  await expect(projeto.getByText("2× Sensor de chuva")).toBeVisible();
  await catalogo.getByRole("button", { name: "Sensor de chuva", exact: true }).click();
  await expect(projeto.getByRole("listitem")).toHaveCount(3);
  await expect(catalogo.getByText("3 no projeto")).toBeVisible();

  // Exaustor: pergunta obrigatória vira pendência; a área da imagem responde.
  await catalogo.getByRole("button", { name: "Catálogo", exact: true }).click();
  await catalogo.getByRole("button", { name: /^Climatização/ }).click();
  await catalogo.getByRole("button", { name: /^Exaustores/ }).click();
  await catalogo.getByRole("button", { name: "Adicionar Exaustor", exact: true }).click();
  const pendencias = page.getByRole("region", { name: "Pendências" });
  await expect(pendencias.getByText('Responda "Tipo de controle".')).toBeVisible();
  const painel = page.getByRole("region", { name: "Configuração de Exaustor" });
  await expect(painel.getByLabel("Modelo")).toHaveValue(/.+/);
  await painel.getByRole("button", { name: "Controle por grupos" }).click();
  await expect(pendencias.getByText('Responda "Tipo de controle".')).toHaveCount(0);
  await expect(painel.getByRole("radio", { name: "Por grupos" })).toBeChecked();
  await painel.getByLabel("Quantidade").fill("4");
  await expect(projeto.getByText("4× Exaustor")).toBeVisible();

  // Rascunho automático: sobrevive ao recarregar.
  await expect(page.getByText(/Rascunho salvo às \d{2}:\d{2}/)).toBeVisible();
  await page.reload();
  await expect(projeto.getByRole("listitem")).toHaveCount(4);
  await expect(projeto.getByText("4× Exaustor")).toBeVisible();
  await projeto.getByRole("button", { name: /4× Exaustor/ }).click();
  await expect(page.getByRole("region", { name: "Configuração de Exaustor" }).getByRole("radio", { name: "Por grupos" })).toBeChecked();

  // Remover um item.
  await projeto.getByRole("button", { name: /1× Estação meteorológica/ }).click();
  await page.getByRole("region", { name: "Configuração de Estação meteorológica" }).getByRole("button", { name: "Remover item" }).click();
  await expect(projeto.getByRole("listitem")).toHaveCount(3);

  // A lista mostra o orçamento.
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
  await page.goto("/");
  const lista = page.getByRole("region", { name: "Orçamentos" });
  await expect(lista.getByText("Granja Exemplo")).toBeVisible();
  await expect(lista.getByText(/3 itens/)).toBeVisible();
});
