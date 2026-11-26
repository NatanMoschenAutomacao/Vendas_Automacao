# 0001 · Arquitetura do configurador

Status: aprovada em 26/11/2026.

## Decisão

- Monólito modular: Next.js (App Router) + TypeScript + Tailwind, PostgreSQL + Prisma.
- Motor de cálculo isolado em `packages/engine`, TypeScript puro, sem banco, rede, relógio ou aleatoriedade.
  `calcular(configuração, snapshot da biblioteca) → resultado`. Roda no navegador (resposta imediata) e no servidor (valor oficial).
- O resultado é sempre recalculado do zero; só as escolhas do vendedor são gravadas. Na emissão, o resultado e o snapshot da biblioteca são congelados.
- Permissões por ação, verificadas no servidor em toda Server Action e consulta.
- Hospedagem com custo zero: Netlify (aplicação) + Supabase (PostgreSQL e arquivos).
- Login por usuário e senha; contas criadas apenas pelo administrador técnico.

## Estágios do motor

1. Perguntas aplicáveis · 2. Estrutura (instâncias, acionamentos, grupos) · 3. Recursos e lista de I/O ·
4. Controladores e cartões · 5. Materiais · 6. Ajustes manuais · 7. Preços · 8. Pendências e descritivo.

Uma regra só lê dados de estágios anteriores ao seu. Isso elimina a dependência circular entre regras de material e recursos de automação.

## Consequências

- Toda lógica de cálculo é testável sem banco (cenários do §48 viram testes do pacote `engine`).
- Novos equipamentos, perguntas e regras são dados, não código.
- O documento completo, com inconsistências resolvidas, modelo de dados e plano por fases, está no planejamento publicado (link no README).
