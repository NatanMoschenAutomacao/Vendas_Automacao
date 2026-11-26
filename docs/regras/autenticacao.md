# Autenticação e permissões

- Login por usuário e senha. Não há cadastro aberto: o administrador técnico cria as contas em *Administração › Usuários*.
- Senhas guardadas com hash Argon2. Mínimo de 8 caracteres, com letras e números.
- Senha temporária (criação ou redefinição) obriga a troca no próximo acesso.
- 5 tentativas erradas bloqueiam o usuário por 15 minutos.
- Sessão em cookie `httpOnly` assinado (JWT HS256, 12 horas). A cada requisição o servidor confirma que o usuário existe e está ativo; desativar um usuário corta o acesso imediatamente.
- Permissões por ação em `apps/web/src/server/auth/permissions.ts`. O vendedor não gerencia a biblioteca, não vê custos e não gerencia usuários.
- Sempre deve existir ao menos um administrador técnico ativo.
- Ações administrativas ficam registradas na tabela de auditoria (quem, quando, antes, depois).
