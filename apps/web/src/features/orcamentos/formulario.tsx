"use client";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { UFS, type DadosBasicos } from "./schema";

export function FormDadosBasicos({
  acao,
  inicial,
  rotuloBotao,
}: {
  acao: (estado: EstadoDoFormulario, form: FormData) => Promise<EstadoDoFormulario>;
  inicial?: Partial<DadosBasicos>;
  rotuloBotao: string;
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="@container flex flex-col gap-4">
      <div className="grid gap-4 @lg:grid-cols-2">
        <Campo rotulo="Cliente" erro={e.cliente}>
          <Input name="cliente" defaultValue={inicial?.cliente ?? ""} required maxLength={160} autoFocus={!inicial} />
        </Campo>
        <Campo rotulo="Empresa" erro={e.empresa} ajuda="Opcional.">
          <Input name="empresa" defaultValue={inicial?.empresa ?? ""} maxLength={160} />
        </Campo>
      </div>
      <Campo rotulo="Projeto" erro={e.projeto} ajuda="Ex.: Aviário 3 – climatização.">
        <Input name="projeto" defaultValue={inicial?.projeto ?? ""} required maxLength={160} />
      </Campo>
      <div className="grid gap-4 @lg:grid-cols-[minmax(0,1fr)_8rem]">
        <Campo rotulo="Cidade" erro={e.cidade}>
          <Input name="cidade" defaultValue={inicial?.cidade ?? ""} maxLength={120} />
        </Campo>
        <Campo rotulo="UF" erro={e.uf}>
          <Select name="uf" defaultValue={inicial?.uf ?? ""}>
            <option value="">—</option>
            {UFS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo rotulo="Observações" erro={e.observacoes}>
        <Textarea name="observacoes" defaultValue={inicial?.observacoes ?? ""} maxLength={4000} />
      </Campo>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>{rotuloBotao}</BotaoEnviar>
      </div>
    </form>
  );
}
