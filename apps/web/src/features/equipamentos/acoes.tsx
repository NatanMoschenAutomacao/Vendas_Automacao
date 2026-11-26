"use client";
import { useRouter } from "next/navigation";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import {
  alternarAtivoEquipamento,
  alternarAtivoModelo,
  duplicarEquipamento,
  duplicarModelo,
  excluirEquipamento,
  excluirModelo,
  moverDefinicao,
  moverEquipamento,
  moverModelo,
  removerDefinicao,
} from "./actions";

interface Linha {
  id: string;
  nome: string;
  ativo?: boolean;
  primeira: boolean;
  ultima: boolean;
}

export function AcoesDoEquipamento({ id, nome, ativo, primeira, ultima }: Linha) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      primeira={primeira}
      ultima={ultima}
      hrefEditar={`/admin/equipamentos/${id}`}
      subir={() => moverEquipamento(id, "cima")}
      descer={() => moverEquipamento(id, "baixo")}
      duplicar={() => duplicarEquipamento(id)}
      alternarAtivo={() => alternarAtivoEquipamento(id)}
      excluir={() => excluirEquipamento(id)}
      avisoExclusao="Os modelos e campos técnicos também serão excluídos."
    />
  );
}

export function AcoesDoModelo({ id, equipamentoId, nome, ativo, primeira, ultima }: Linha & { equipamentoId: string }) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      primeira={primeira}
      ultima={ultima}
      hrefEditar={`/admin/equipamentos/${equipamentoId}/modelos/${id}`}
      subir={() => moverModelo(id, "cima")}
      descer={() => moverModelo(id, "baixo")}
      duplicar={() => duplicarModelo(id)}
      alternarAtivo={() => alternarAtivoModelo(id)}
      excluir={() => excluirModelo(id)}
    />
  );
}

export function AcoesDaDefinicao({ id, nome, primeira, ultima }: Linha) {
  return (
    <AcoesDeLinha
      nome={nome}
      primeira={primeira}
      ultima={ultima}
      subir={() => moverDefinicao(id, "cima")}
      descer={() => moverDefinicao(id, "baixo")}
      excluir={async () => {
        await removerDefinicao(id);
        return { ok: true };
      }}
      avisoExclusao="Os valores já preenchidos nos modelos deixam de ser usados."
    />
  );
}

/** Ações no cabeçalho da página do equipamento: duplicar, ativar/inativar e excluir. */
export function AcoesDoCabecalhoDoEquipamento({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  const router = useRouter();
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      duplicar={() => duplicarEquipamento(id)}
      alternarAtivo={() => alternarAtivoEquipamento(id)}
      excluir={async () => {
        const r = await excluirEquipamento(id);
        router.push("/admin/equipamentos");
        return r;
      }}
      avisoExclusao="Os modelos e campos técnicos também serão excluídos."
    />
  );
}

/** Ações no cabeçalho da página do modelo. */
export function AcoesDoCabecalhoDoModelo({ id, equipamentoId, nome, ativo }: { id: string; equipamentoId: string; nome: string; ativo: boolean }) {
  const router = useRouter();
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      duplicar={async () => {
        await duplicarModelo(id);
        router.push(`/admin/equipamentos/${equipamentoId}?aba=modelos`);
      }}
      alternarAtivo={() => alternarAtivoModelo(id)}
      excluir={async () => {
        const r = await excluirModelo(id);
        router.push(`/admin/equipamentos/${equipamentoId}?aba=modelos`);
        return r;
      }}
    />
  );
}
