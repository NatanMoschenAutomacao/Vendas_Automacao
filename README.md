# Configurador de Orçamentos de Automação · Zanatta

Aplicação web interna para montar orçamentos de automação agrícola. O vendedor
seleciona visualmente o que o cliente precisa; o sistema calcula materiais,
recursos de automação, controladores e valores a partir das regras cadastradas
pela equipe de automação.

Planejamento completo da arquitetura: [documento de planejamento](https://claude.ai/artifact/32icxuVX7dsHpN7DCBLKUg)
e resumo em [`docs/decisoes/0001-arquitetura.md`](docs/decisoes/0001-arquitetura.md).

## Estado atual: Fases 01 a 11

- **Biblioteca técnica:** categorias, equipamentos e modelos com características, imagens, perguntas dinâmicas com herança e condições, kits e imagens interativas.
- **Configurador do vendedor:** seleção visual, quantidades, perguntas, ambientes, setores, painéis, grupos de controle e rascunho automático.
- **Motor de cálculo** (`@zanatta/engine`, sem I/O):
  - regras de composição e recursos de automação;
  - lista de materiais totalizada e detalhada, lista de I/O e ajustes manuais;
  - controladores, saídas funcionais e compatibilidade;
  - reserva técnica e busca de combinações de cartões;
  - preços em decimal exato, descontos e impostos;
  - descritivo técnico e pendências.
- **Comercial:** preços com histórico (venda fixa ou custo + regra), serviços, regra comercial, impostos e limite de desconto do vendedor. O vendedor nunca recebe custo.
- **Documentos:** proposta e orçamento interno em PDF e Excel. Status Rascunho → Aguardando validação → Validado → Emitido, com emissão congelada e novas revisões.
- **Testes:** unitários (Vitest) e de interface (Playwright), fase a fase. Veja [`docs/validacao/cenarios.md`](docs/validacao/cenarios.md).
- **Próximo passo:** homologação com dados reais, em [`docs/validacao/roteiro-de-homologacao.md`](docs/validacao/roteiro-de-homologacao.md).

Regras documentadas: [`autenticação`](docs/regras/autenticacao.md), [`precificação`](docs/regras/precificacao.md) e [`documentos`](docs/regras/documentos.md).

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
   Para o envio de imagens (Fase 02), cadastre também `SUPABASE_URL` (ex.: `https://PROJETO.supabase.co`) e
   `SUPABASE_SERVICE_ROLE_KEY` (Supabase › *Project Settings › API Keys*, chave `service_role` ou *secret*).
   O bucket público `imagens` é criado no primeiro envio. Sem essas variáveis o envio de imagens é recusado em produção.
4. Faça o deploy. As migrations são aplicadas automaticamente a cada deploy.
5. Crie o primeiro administrador uma única vez, no seu computador, apontando para o Supabase:
   ```bash
   cd apps/web
   DATABASE_URL="<DIRECT_URL do Supabase>" SEED_ADMIN_USUARIO=admin SEED_ADMIN_SENHA="<senha temporária>" pnpm db:seed
   ```

Limites do plano gratuito do Supabase: 500 MB de banco, 1 GB de arquivos, e o projeto é pausado após 7 dias sem uso (reativa com um clique no painel).
