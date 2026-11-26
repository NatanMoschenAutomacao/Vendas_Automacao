# Instruções para agentes

- Idioma do código de domínio, interface e documentação: português do Brasil.
- Planejamento aprovado: docs/decisoes/0001-arquitetura.md. Não altere funcionalidades aprovadas sem justificativa.
- O pacote `packages/engine` não pode importar Prisma, React, Next ou qualquer I/O. Toda lógica de cálculo fica nele, com testes.
- Toda Server Action começa com `exigirPermissao(...)` (apps/web/src/server/auth/dal.ts). Nunca confie só na interface.
- Não invente dados técnicos ou comerciais (códigos, preços, capacidades). Dados de exemplo usam `isDemo = true` e aparecem como DEMO.
- Prioridade de custo zero: não adicione serviços pagos.
- Antes de concluir: `pnpm typecheck && pnpm lint && pnpm test && pnpm build` e os testes e2e (veja o README).
- Next.js 16: leia apps/web/AGENTS.md. `middleware` agora se chama `proxy` (src/proxy.ts).
