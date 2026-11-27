"use client";
import { useRouter } from "next/navigation";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import { alternarAtivoKit, excluirKit, moverKit } from "./actions";

export function AcoesDoKit({ id, nome, ativo, primeira, ultima, noCabecalho }: { id: string; nome: string; ativo: boolean; primeira?: boolean; ultima?: boolean; noCabecalho?: boolean }) {
  const router = useRouter();
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      primeira={primeira}
      ultima={ultima}
      hrefEditar={noCabecalho ? undefined : `/admin/kits/${id}`}
      subir={noCabecalho ? undefined : () => moverKit(id, "cima")}
      descer={noCabecalho ? undefined : () => moverKit(id, "baixo")}
      alternarAtivo={() => alternarAtivoKit(id)}
      excluir={async () => {
        await excluirKit(id);
        if (noCabecalho) router.push("/admin/kits");
      }}
      avisoExclusao="Orçamentos que já usaram o kit não são afetados."
    />
  );
}
