/** Edição imutável dos serviços manuais e dos dados comerciais (usada pelo configurador). */
import type { ConfiguracaoDoProjeto, Id } from "../types";
import type { AjusteComercial, DadosComerciais } from "./tipos";

export function adicionarServico(c: ConfiguracaoDoProjeto, id: Id, servicoId: Id, quantidade: number): ConfiguracaoDoProjeto {
  return { ...c, servicos: [...(c.servicos ?? []), { id, servicoId, quantidade }] };
}

export function alterarQuantidadeDoServico(c: ConfiguracaoDoProjeto, id: Id, quantidade: number): ConfiguracaoDoProjeto {
  return { ...c, servicos: (c.servicos ?? []).map((s) => (s.id === id ? { ...s, quantidade } : s)) };
}

export function removerServico(c: ConfiguracaoDoProjeto, id: Id): ConfiguracaoDoProjeto {
  return { ...c, servicos: (c.servicos ?? []).filter((s) => s.id !== id) };
}

export function adicionarAjusteComercial(c: ConfiguracaoDoProjeto, ajuste: AjusteComercial): ConfiguracaoDoProjeto {
  return { ...c, comercial: { ...c.comercial, ajustes: [...(c.comercial?.ajustes ?? []), ajuste] } };
}

export function removerAjusteComercial(c: ConfiguracaoDoProjeto, id: Id): ConfiguracaoDoProjeto {
  return { ...c, comercial: { ...c.comercial, ajustes: (c.comercial?.ajustes ?? []).filter((a) => a.id !== id) } };
}

type Condicoes = Omit<DadosComerciais, "ajustes">;

export function atualizarCondicoesComerciais(c: ConfiguracaoDoProjeto, mudanca: Condicoes): ConfiguracaoDoProjeto {
  return { ...c, comercial: { ...c.comercial, ...mudanca } };
}
