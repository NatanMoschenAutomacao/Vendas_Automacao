"use client";
import { Campo, Select } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";

/** Escolha do item do catálogo que entra na lista quando o modelo é fornecido. */
export function FormItemDoModelo({
  acao,
  itens,
  valor,
}: {
  acao: (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;
  itens: { id: string; codigo: string; descricao: string; ativo: boolean }[];
  valor: string | null;
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Item de fornecimento">
      <Campo
        rotulo="Item de fornecimento"
        erro={estado.erros?.itemId}
        ajuda="Quando o vendedor marca o equipamento como fornecido, este item entra na lista de materiais."
      >
        <Select name="itemId" defaultValue={valor ?? ""}>
          <option value="">Nenhum</option>
          {itens
            .filter((i) => i.ativo || i.id === valor)
            .map((i) => (
              <option key={i.id} value={i.id}>
                {i.codigo} — {i.descricao}
              </option>
            ))}
        </Select>
      </Campo>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar variante="secundario" pendente={pendente}>
          Salvar item
        </BotaoEnviar>
      </div>
    </form>
  );
}
