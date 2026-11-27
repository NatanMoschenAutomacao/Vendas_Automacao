# Roteiro de homologação (Fase 11)

Objetivo: carregar os dados reais, conferir o sistema contra orçamentos já feitos à mão e só então liberar para os vendedores.

## 1. Preparar o ambiente

- [ ] Juntar os PRs #3 a #10, em ordem, na `main`.
- [ ] Conferir no Netlify as variáveis `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (veja o README).
- [ ] Fazer o deploy (as migrations rodam sozinhas) e criar o primeiro administrador com o seed.
- [ ] Criar os usuários: administradores técnicos e vendedores.

## 2. Carregar os dados reais (equipe de automação)

Na ordem abaixo, porque cada cadastro depende dos anteriores. Nada é inventado pelo sistema: tudo sai das fichas técnicas e das tabelas de preço da empresa.

1. [ ] **Categorias e sistemas** (Climatização, Monitoramento…).
2. [ ] **Componentes elétricos**: importar a planilha de itens (código, descrição, unidade, fabricante, grupo e, se já tiver, custo, venda e modo de preço).
3. [ ] **Recursos de automação** (DI, DO, AI, AO, SP, comunicação) e **funções de controle**.
4. [ ] **Tipos de painel** e as regras de componentes gerais de cada tipo (gabinete, disjuntor geral, DPS, fonte…).
5. [ ] **Equipamentos e modelos**, com características técnicas, imagens, item de fornecimento e perguntas.
6. [ ] **Regras de composição** por equipamento e modelo: materiais, recursos, acionamentos e proteções.
7. [ ] **Controladores** (MT530, MT543, Galcon, Altus…) a partir das fichas: recursos integrados, saídas funcionais, modelos e cartões compatíveis.
8. [ ] **Cartões de expansão** e a **reserva técnica padrão**.
9. [ ] **Preços**: conferir em Administração › Preços › "Sem preço" até a lista ficar vazia; cadastrar **serviços**.
10. [ ] **Configurações gerais**: regra comercial, impostos (definidos pelo comercial ou contábil) e limite de desconto do vendedor.
11. [ ] **Textos do descritivo**, seção por seção.
12. [ ] **Kits** (estação completa) e **imagens interativas**.
13. [ ] Inativar ou excluir os cadastros DEMO.

## 3. Comparar com orçamentos feitos à mão

Escolher de 3 a 5 orçamentos reais recentes, de tamanhos diferentes (um pequeno, um com vários galpões, um com CLP e cartões).

Para cada um:

- [ ] Montar o mesmo projeto no configurador.
- [ ] Baixar o **Orçamento interno (Excel)**.
- [ ] Comparar com o orçamento manual, aba a aba:
  - lista totalizada (códigos e quantidades);
  - lista de I/O e controladores escolhidos;
  - cartões de expansão;
  - preços por linha, subtotais, impostos e total.
- [ ] Anotar cada diferença com o motivo: regra faltando, regra errada, preço desatualizado ou erro no orçamento manual.
- [ ] Corrigir os cadastros e repetir até bater.

## 4. Validar com os vendedores (§49)

- [ ] Cada vendedor monta um orçamento sozinho, do zero, e anota onde travou.
- [ ] Conferir que o vendedor não vê custo nem margem e não passa do limite de desconto.
- [ ] Testar o fluxo completo: enviar para validação, validar (administrador), emitir, baixar a proposta e abrir uma nova revisão.

## 5. Liberar

- [ ] Todos os itens acima conferidos.
- [ ] Combinar quem mantém os preços atualizados e com que frequência.
