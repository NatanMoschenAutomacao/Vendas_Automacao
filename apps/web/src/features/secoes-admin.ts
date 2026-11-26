/**
 * Seções da área administrativa (§4.2). `fase` indica quando cada uma passa
 * a funcionar; seções sem rota ainda aparecem desabilitadas no menu.
 */
export interface SecaoAdmin {
  titulo: string;
  descricao: string;
  href?: string;
  fase: number;
}

export const SECOES_ADMIN: SecaoAdmin[] = [
  { titulo: "Categorias e sistemas", descricao: "Árvore de categorias e sistemas.", href: "/admin/categorias", fase: 1 },
  { titulo: "Usuários", descricao: "Contas, perfis e senhas.", href: "/admin/usuarios", fase: 1 },
  {
    titulo: "Equipamentos e modelos",
    descricao: "Cadastro, características técnicas e imagens.",
    href: "/admin/equipamentos",
    fase: 2,
  },
  { titulo: "Perguntas e regras", descricao: "Perguntas dinâmicas e condições de exibição.", fase: 3 },
  { titulo: "Imagens interativas", descricao: "Hotspots e conjuntos padrão (kits).", fase: 4 },
  { titulo: "Componentes elétricos", descricao: "Catálogo central e composições.", fase: 6 },
  { titulo: "Recursos de automação", descricao: "DI, DO, AI, AO, SP e comunicação.", fase: 6 },
  { titulo: "Controladores", descricao: "Funções, saídas funcionais e compatibilidades.", fase: 7 },
  { titulo: "CLPs e cartões", descricao: "Capacidades e expansões.", fase: 8 },
  { titulo: "Serviços e preços", descricao: "Serviços, preços e regras comerciais.", fase: 9 },
  { titulo: "Modelos de texto", descricao: "Trechos do descritivo técnico.", fase: 10 },
  { titulo: "Configurações gerais", descricao: "Reserva técnica, arredondamento, empresa.", fase: 9 },
];
