/**
 * Permissões por ação (não só por perfil). A interface usa estas funções
 * para esconder o que o usuário não pode fazer, mas a verificação que vale
 * é a do servidor, em cada Server Action e consulta.
 */
export const PERFIS = ["ADMIN_TECNICO", "VENDEDOR"] as const;
export type PerfilUsuario = (typeof PERFIS)[number];

export const ACOES = [
  "orcamento:criar",
  "orcamento:ver",
  /** Ver e editar orçamentos de todos os vendedores. */
  "orcamento:ver-todos",
  /** Validar tecnicamente, devolver ao rascunho e ver o orçamento interno. */
  "orcamento:validar",
  "biblioteca:ver",
  "biblioteca:gerenciar",
  "precos:ver-custo",
  /** Cadastrar preços, serviços, regra comercial, impostos e limite de desconto. */
  "precos:gerenciar",
  /** Aplicar descontos acima do limite do vendedor e descontos em valor. */
  "precos:desconto-livre",
  "usuarios:gerenciar",
  "configuracoes:gerenciar",
] as const;
export type Acao = (typeof ACOES)[number];

const PERMISSOES: Record<PerfilUsuario, ReadonlySet<Acao>> = {
  ADMIN_TECNICO: new Set(ACOES),
  VENDEDOR: new Set<Acao>(["orcamento:criar", "orcamento:ver"]),
};

export function pode(perfil: PerfilUsuario, acao: Acao): boolean {
  return PERMISSOES[perfil].has(acao);
}

export const ROTULO_PERFIL: Record<PerfilUsuario, string> = {
  ADMIN_TECNICO: "Administrador técnico",
  VENDEDOR: "Vendedor",
};
