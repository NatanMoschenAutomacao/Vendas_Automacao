"use client";
import type { ReservaTecnica } from "@zanatta/engine";
import { Campo, Input, Select } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CODIGOS_DE_RESERVA, ROTULO_MODO_RESERVA } from "./schema";

export function FormReservaPadrao({
  acao,
  inicial,
}: {
  acao: (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;
  inicial: ReservaTecnica;
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Reserva técnica padrão">
      <Campo rotulo="Modo da reserva" ajuda="Percentual arredonda para cima. Vale para os projetos que não definem a própria reserva.">
        <Select name="modo" defaultValue={inicial.modo}>
          {Object.entries(ROTULO_MODO_RESERVA).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </Select>
      </Campo>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CODIGOS_DE_RESERVA.map((c) => (
          <Campo key={c} rotulo={`Reserva de ${c}`}>
            <Input name={`reserva-${c}`} inputMode="decimal" defaultValue={String(inicial.valores[c] ?? 0)} />
          </Campo>
        ))}
      </div>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Salvar reserva</BotaoEnviar>
      </div>
    </form>
  );
}
