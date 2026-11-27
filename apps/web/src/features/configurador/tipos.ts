import type { KitNoSnapshot, SnapshotDaBiblioteca } from "@zanatta/engine";

/** Dados da biblioteca que o configurador do vendedor recebe (sem custos). */
export interface CategoriaDoConfigurador {
  id: string;
  nome: string;
  descricao: string | null;
  paiId: string | null;
  ordem: number;
}

export interface ModeloDoConfigurador {
  id: string;
  nome: string;
  codigo: string;
  ativo: boolean;
  isDemo: boolean;
  imagemUrl: string | null;
}

export interface EquipamentoDoConfigurador {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  tipo: "EQUIPAMENTO" | "SENSOR" | "ACESSORIO";
  categoriaId: string;
  ativo: boolean;
  isDemo: boolean;
  imagemUrl: string | null;
  modelos: ModeloDoConfigurador[];
}

export interface KitDoConfigurador extends KitNoSnapshot {
  descricao: string | null;
  categoriaId: string;
  isDemo: boolean;
  imagemUrl: string | null;
}

export type AlvoDeHotspot = "EQUIPAMENTO" | "MODELO" | "KIT" | "PERGUNTA" | "OPCAO";

export interface HotspotDoConfigurador {
  id: string;
  rotulo: string;
  forma: "RETANGULO" | "ELIPSE";
  x: number;
  y: number;
  largura: number;
  altura: number;
  alvoTipo: AlvoDeHotspot;
  alvoId: string;
  alvoValor: string | null;
}

export interface ImagemInterativaDoConfigurador {
  id: string;
  nome: string;
  url: string;
  largura: number | null;
  altura: number | null;
  textoAlternativo: string | null;
  categoriaId: string | null;
  equipamentoId: string | null;
  isDemo: boolean;
  hotspots: HotspotDoConfigurador[];
}

export interface BibliotecaDoConfigurador {
  categorias: CategoriaDoConfigurador[];
  equipamentos: EquipamentoDoConfigurador[];
  kits: KitDoConfigurador[];
  imagens: ImagemInterativaDoConfigurador[];
  snapshot: SnapshotDaBiblioteca;
}
