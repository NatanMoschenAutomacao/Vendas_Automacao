import { expect, test, type Page } from "@playwright/test";

// Roda depois da fase05: Granja Exemplo com 4 exaustores (acionamento individual) no painel QC-01, tipo Controle.

async function entrar(page: Page, usuario: string, senha: string, destino: RegExp) {
  await page.goto("/login");
  await page.getByLabel("Usuário").fill(usuario);
  await page.getByLabel("Senha").fill(senha);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(destino);
}

async function novaRegra(
  page: Page,
  dados: { codigo: string; nome: string; base?: string; efeito: { tipo?: string; alvo: string; formula: string; funcao?: string; arredondamento?: string } },
) {
  await page.getByLabel("Código", { exact: true }).fill(dados.codigo);
  await page.getByLabel("Nome", { exact: true }).fill(dados.nome);
  if (dados.base) await page.getByRole("combobox", { name: "Base de cálculo", exact: true }).selectOption(dados.base);
  await page.getByRole("button", { name: "Adicionar efeito" }).click();
  const efeito = page.locator('[data-efeito="0"]');
  if (dados.efeito.tipo) await efeito.getByRole("combobox", { name: "Tipo de recurso do efeito 1", exact: true }).selectOption({ label: dados.efeito.alvo });
  else await efeito.getByRole("combobox", { name: "Item do efeito 1", exact: true }).selectOption({ label: dados.efeito.alvo });
  await efeito.getByLabel("Fórmula do efeito 1").fill(dados.efeito.formula);
  if (dados.efeito.funcao) await efeito.getByLabel("Função do sinal do efeito 1").fill(dados.efeito.funcao);
  if (dados.efeito.arredondamento)
    await efeito.getByRole("combobox", { name: "Arredondamento do efeito 1", exact: true }).selectOption(dados.efeito.arredondamento);
  await page.getByRole("button", { name: "Salvar regra" }).click();
  await expect(page.getByText("Regra criada.")).toBeVisible();
}

const linha = (page: Page, codigo: string) => page.getByRole("region", { name: "Lista de materiais" }).locator(`tr[data-codigo="${codigo}"]`);

test("Fase 06: catálogo, regras, lista de materiais, I/O e ajustes manuais", async ({ page }) => {
  await entrar(page, "admin", "NovaSenha2026", /\/admin$/);

  // Catálogo central: cadastro manual e importação por planilha (DEMO).
  await page.goto("/admin/componentes");
  const novo = page.getByRole("form", { name: "Novo item" });
  await novo.getByLabel("Código interno").fill("ct-09");
  await novo.getByLabel("Descrição").fill("Contator 9A DEMO");
  await novo.getByLabel("Dado de demonstração (DEMO)").check();
  await novo.getByRole("button", { name: "Criar item" }).click();
  await expect(page.getByText("Item CT-09 criado.")).toBeVisible();

  const importar = page.getByRole("form", { name: "Importar itens" });
  await importar
    .getByLabel("Planilha")
    .fill("codigo;descricao;unidade;fracionavel\nGAB-01;Gabinete DEMO;pç;não\nCB-1;Cabo 1,5 mm DEMO;m;sim\nEXA-01;Exaustor fornecido DEMO;pç;não\nGAB-01;Repetido;pç;não");
  await importar.getByLabel("Marcar itens novos como DEMO").check();
  await importar.getByRole("button", { name: "Simular" }).click();
  await expect(importar.getByRole("status")).toContainText("Simulação: 3 novo(s), 0 atualizado(s), 1 com erro.");
  await expect(importar.getByText(/código GAB-01 repetido/)).toBeVisible();
  await importar.getByRole("button", { name: "Importar" }).click();
  await expect(importar.getByText("Importação concluída: 3 novo(s), 0 atualizado(s).")).toBeVisible();
  await page.reload();
  const catalogo = page.getByRole("region", { name: "Itens do catálogo" });
  await expect(catalogo.getByText("Cabo 1,5 mm DEMO")).toBeVisible();

  // Recursos de automação padrão.
  await page.goto("/admin/recursos");
  await page.getByRole("button", { name: "Adicionar DI, DO, AI e AO" }).click();
  await expect(page.getByText("4 tipo(s) criado(s).")).toBeVisible();

  // Regras do Exaustor: contator por acionamento e um DO por acionamento.
  await page.goto("/admin/equipamentos");
  await page.getByRole("region", { name: "Lista de equipamentos" }).getByRole("link", { name: /^Exaustor DEMO/ }).click();
  await page.getByRole("link", { name: "Materiais e recursos" }).click();
  await expect(page).toHaveURL(/aba=materiais/);
  const urlDoEquipamento = page.url();
  await page.getByRole("link", { name: "Nova regra de material" }).click();
  // Variável desconhecida é recusada pelo servidor.
  await page.getByLabel("Código", { exact: true }).fill("EXA-ERRO");
  await page.getByLabel("Nome", { exact: true }).fill("Teste");
  await page.getByRole("button", { name: "Adicionar efeito" }).click();
  await page.getByRole("combobox", { name: "Item do efeito 1", exact: true }).selectOption({ label: "CT-09 — Contator 9A DEMO (pç)" });
  await page.getByLabel("Fórmula do efeito 1").fill("xyz.abc * 2");
  await page.getByRole("button", { name: "Salvar regra" }).click();
  await expect(page.getByText("Variável desconhecida: xyz.abc.")).toBeVisible();
  await page.reload();
  await novaRegra(page, {
    codigo: "exa-contator",
    nome: "Contator por acionamento",
    base: "por_acionamento",
    efeito: { alvo: "CT-09 — Contator 9A DEMO (pç)", formula: "base.quantidade" },
  });
  await page.goto(urlDoEquipamento);
  await page.getByRole("link", { name: "Nova regra de recurso" }).click();
  await novaRegra(page, {
    codigo: "EXA-DO",
    nome: "Saída digital por acionamento",
    base: "por_acionamento",
    efeito: { tipo: "recurso", alvo: "DO — Saída digital", formula: "base.quantidade", funcao: "Liga/desliga" },
  });
  await page.goto(urlDoEquipamento);
  await expect(page.getByRole("list", { name: "Regras do equipamento" }).getByText("Contator por acionamento")).toBeVisible();

  // Regras do tipo de painel Controle: gabinete e cabo proporcional.
  await page.goto("/admin/regras");
  await page.getByRole("link", { name: "Controle", exact: true }).click();
  await novaRegra(page, { codigo: "GAB-CONTROLE", nome: "Gabinete do painel", efeito: { alvo: "GAB-01 — Gabinete DEMO (pç)", formula: "1" } });
  await page.goto("/admin/regras");
  await page.getByRole("link", { name: "Controle", exact: true }).click();
  await novaRegra(page, {
    codigo: "CABO-CONTROLE",
    nome: "Cabo por equipamento",
    efeito: { alvo: "CB-1 — Cabo 1,5 mm DEMO (m)", formula: "painel.equipamentos * 2.5", arredondamento: "nenhum" },
  });
  await page.goto("/admin/regras");
  await expect(page.getByRole("heading", { name: "Tipo de painel: Controle" })).toBeVisible();

  // Item de fornecimento do Modelo 01.
  await page.goto(urlDoEquipamento.replace(/\?.*$/, "?aba=modelos"));
  await page.getByRole("region", { name: "Modelos" }).getByRole("link", { name: /^Modelo 01 DEMO M01 / }).click();
  const item = page.getByRole("form", { name: "Item de fornecimento" });
  await item.getByRole("combobox", { name: "Item de fornecimento" }).selectOption({ label: "EXA-01 — Exaustor fornecido DEMO" });
  await item.getByRole("button", { name: "Salvar item" }).click();
  await expect(page.getByText("Item de fornecimento salvo.")).toBeVisible();

  // ───────── Vendedor ─────────
  await page.context().clearCookies();
  await entrar(page, "vendedor1", "Vendedor2026", /\/$/);
  await page.getByRole("region", { name: "Orçamentos" }).getByRole("link", { name: /Granja Exemplo/ }).click();
  await page.getByRole("button", { name: "Materiais e I/O" }).click();
  await expect(linha(page, "CT-09")).toHaveAttribute("data-quantidade", "4");
  await expect(linha(page, "GAB-01")).toHaveAttribute("data-quantidade", "1");
  await expect(linha(page, "CB-1")).toHaveAttribute("data-quantidade", "10");
  await expect(linha(page, "EXA-01")).toHaveAttribute("data-quantidade", "4");
  const io = page.getByRole("region", { name: "Lista de I/O" });
  await expect(io.locator('tr[data-painel="QC-01"] [data-recurso="DO"]')).toHaveText("4");

  // Origem rastreável.
  await linha(page, "CT-09").getByRole("button", { name: "Origens de CT-09" }).click();
  const origens = page.getByRole("list", { name: "Origens de CT-09" });
  await expect(origens.getByText(/Regra EXA-CONTATOR · Exaustor · base 4/)).toBeVisible();

  // Ajuste de quantidade com justificativa.
  await origens.getByRole("button", { name: "Ajustar quantidade de CT-09" }).click();
  const ajuste = page.getByRole("group", { name: "Ajustar quantidade" });
  await ajuste.getByLabel("Nova quantidade").fill("5");
  await expect(ajuste.getByRole("button", { name: "Aplicar ajuste" })).toBeDisabled();
  await ajuste.getByLabel("Justificativa").fill("Reserva no painel");
  await ajuste.getByRole("button", { name: "Aplicar ajuste" }).click();
  await expect(linha(page, "CT-09")).toHaveAttribute("data-quantidade", "5");
  await expect(linha(page, "CT-09").getByText("Ajustado")).toBeVisible();

  // Item avulso.
  const avulso = page.getByRole("group", { name: "Adicionar item avulso" });
  await avulso.getByLabel("Buscar no catálogo").fill("gab");
  await avulso.getByRole("combobox", { name: "Item avulso", exact: true }).selectOption({ label: "GAB-01 — Gabinete DEMO (pç)" });
  await avulso.getByLabel("Justificativa do item avulso").fill("Gabinete reserva");
  await avulso.getByRole("button", { name: "Adicionar item" }).click();
  await expect(linha(page, "GAB-01")).toHaveAttribute("data-quantidade", "2");
  const ajustes = page.getByRole("region", { name: "Ajustes manuais" });
  await expect(ajustes.locator("li[data-ajuste]")).toHaveCount(2);

  // Equipamento existente no cliente não gera a linha de fornecimento (cenário 17).
  await page.getByRole("button", { name: "Equipamentos", exact: true }).click();
  await page.getByRole("list", { name: "Itens do projeto" }).getByRole("button", { name: /4× Exaustor/ }).click();
  await page.getByRole("region", { name: "Configuração de Exaustor" }).getByRole("combobox", { name: "Fornecimento", exact: true }).selectOption("existente");
  await page.getByRole("button", { name: "Materiais e I/O" }).click();
  await expect(linha(page, "EXA-01")).toHaveCount(0);
  await expect(linha(page, "CT-09")).toHaveAttribute("data-quantidade", "5");

  // Persistência com autor registrado pelo servidor.
  await expect(page.getByText(/Rascunho salvo às/)).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Materiais e I/O" }).click();
  await expect(linha(page, "CT-09")).toHaveAttribute("data-quantidade", "5");
  await expect(ajustes.getByText(/Reserva no painel · .+ · \d{2}\/\d{2}\/\d{4}/)).toBeVisible();
});
