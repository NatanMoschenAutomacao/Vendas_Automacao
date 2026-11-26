# Configurador de Orçamentos de Automação · Zanatta

Aplicação web interna para montar orçamentos de automação agrícola. O vendedor
seleciona visualmente o que o cliente precisa; o sistema calcula materiais,
recursos de automação, controladores e valores a partir das regras cadastradas
pela equipe de automação.

Planejamento completo da arquitetura: [documento de planejamento](https://claude.ai/artifact/32icxuVX7dsHpN7DCBLKUg)
e resumo em [`docs/decisoes/0001-arquitetura.md`](docs/decisoes/0001-arquitetura.md).

## Estado atual: Fase 01 (estrutura inicial)

- Login por usuário e senha, com dois perfis (administrador técnico e vendedor) e permissões verificadas no servidor.
- Área comercial (tela inicial) e área administrativa com navegação.
- Cadastro real de categorias e sistemas (criar, editar, mover, duplicar, inativar, excluir) e de usuários.
- Pacote `@zanatta/engine` com o contrato do motor de cálculo e o pipeline de estágios.
- Testes unitários (Vitest) e de interface (Playwright), CI no GitHub Actions.

## Estrutura

```text
apps/web/              Aplicação Next.js (telas, Server Actions, Prisma)
  prisma/              Schema, migrations e seed
  src/app/             Rotas: (auth), (comercial), (admin)
  src/features/        Regras e componentes por domínio
  src/server/          Banco, autenticação, permissões, auditoria
  src/ui/              Design system
  e2e/                 Testes de interface
packages/engine/       Motor de cálculo em TypeScript puro, sem I/O
docs/                  Decisões e regras documentadas
```

## Rodar localmente

Requisitos: Node 22+, pnpm 10+, PostgreSQL 16 local.

```bash
pnpm install
cp apps/web/.env.example apps/web/.env   # ajuste DATABASE_URL para o PostgreSQL local
pnpm db:migrate                           # cria as tabelas
pnpm db:seed                              # cria o admin e as categorias iniciais
pnpm dev                                  # http://localhost:3000
```

Entre com o usuário definido em `SEED_ADMIN_USUARIO` e a senha de `SEED_ADMIN_SENHA`.
O sistema pede a troca de senha no primeiro acesso.

## Testes

```bash
pnpm test        # unitários (motor + regras do app)
pnpm typecheck
pnpm lint
pnpm build && E2E_ADMIN_URL=postgresql://postgres:postgres@localhost:5432/postgres pnpm --filter web test:e2e
```

Os testes de interface criam um banco novo e descartável a cada execução; nunca usam o banco configurado em `DATABASE_URL`.

## Deploy (custo zero): Supabase + Netlify

1. **Supabase** (banco): crie um projeto gratuito na região São Paulo. Em *Project Settings › Database › Connection string*, copie:
   - a URL do pooler em modo *Transaction* (porta 6543), acrescente `?pgbouncer=true` → `DATABASE_URL`;
   - a URL em modo *Session* (porta 5432) → `DIRECT_URL`.
2. **Netlify** (aplicação): *Add new site › Import from GitHub* e escolha este repositório. O `netlify.toml` já define a pasta e o comando.
3. Em *Site configuration › Environment variables* do Netlify, cadastre:
   `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET` (gere com `openssl rand -base64 48`).
4. Faça o deploy. As migrations são aplicadas automaticamente a cada deploy.
5. Crie o primeiro administrador uma única vez, no seu computador, apontando para o Supabase:
   ```bash
   cd apps/web
   DATABASE_URL="<DIRECT_URL do Supabase>" SEED_ADMIN_USUARIO=admin SEED_ADMIN_SENHA="<senha temporária>" pnpm db:seed
   ```

Limites do plano gratuito do Supabase: 500 MB de banco, 1 GB de arquivos, e o projeto é pausado após 7 dias sem uso (reativa com um clique no painel).
