"use client";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CaixaDeSelecao } from "@/features/equipamentos/formularios";
import { alternarAtivoCartao, excluirCartao } from "./actions";

type Acao = (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;

export function FormNovoCartao({ acao, itens }: { acao: Acao; itens: { id: string; codigo: string; descricao: string }[] }) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Novo cartão">
      <Campo rotulo="Item do catálogo" erro={estado.erros?.itemId} ajuda="Cadastre o item em Componentes elétricos antes.">
        <Select name="itemId" defaultValue="" required>
          <option value="">Escolha…</option>
          {itens.map((i) => (
            <option key={i.id} value={i.id}>
              {i.codigo} — {i.descricao}
            </option>
          ))}
        </Select>
      </Campo>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Criar cartão</BotaoEnviar>
      </div>
    </form>
  );
}

export function FormCartao({
  acao,
  inicial,
}: {
  acao: Acao;
  inicial: { barramento: string | null; consumo: number | null; tipoDeSinal: string | null; observacoes: string | null; isDemo: boolean };
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="@container flex flex-col gap-4" aria-label="Dados do cartão">
      <div className="grid gap-4 @lg:grid-cols-3">
        <Campo rotulo="Barramento" erro={e.barramento}>
          <Input name="barramento" defaultValue={inicial.barramento ?? ""} maxLength={60} />
        </Campo>
        <Campo rotulo="Consumo no barramento (mA)" erro={e.consumo} ajuda="Vazio = não informado.">
          <Input name="consumo" inputMode="numeric" defaultValue={inicial.consumo ?? ""} />
        </Campo>
        <Campo rotulo="Tipo de sinal ou saída" erro={e.tipoDeSinal} ajuda="Ex.: relé, transistor, 4–20 mA.">
          <Input name="tipoDeSinal" defaultValue={inicial.tipoDeSinal ?? ""} maxLength={120} />
        </Campo>
      </div>
      <Campo rotulo="Observações" erro={e.observacoes}>
        <Textarea name="observacoes" defaultValue={inicial.observacoes ?? ""} maxLength={2000} />
      </Campo>
      <CaixaDeSelecao name="isDemo" rotulo="Dado de demonstração (DEMO)" defaultChecked={inicial.isDemo} />
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Salvar cartão</BotaoEnviar>
      </div>
    </form>
  );
}

export function FormControladoresDoCartao({
  acao,
  controladores,
  marcados,
}: {
  acao: Acao;
  controladores: { id: string; codigo: string; descricao: string; barramento: string | null }[];
  marcados: string[];
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Controladores compatíveis">
      {controladores.length === 0 && <p className="text-sm text-gray-500">Nenhum controlador cadastrado.</p>}
      <div className="flex flex-col gap-1.5">
        {controladores.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="controladores" value={c.id} defaultChecked={marcados.includes(c.id)} className="accent-marca-600" />
            {c.descricao} <span className="font-mono text-xs text-gray-400">{c.codigo}</span>
            {c.barramento && <span className="text-xs text-gray-500">· barramento {c.barramento}</span>}
          </label>
        ))}
      </div>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar variante="secundario" pendente={pendente}>
          Salvar compatibilidade
        </BotaoEnviar>
      </div>
    </form>
  );
}

export function AcoesDoCartao({ id, nome, ativo, noCabecalho }: { id: string; nome: string; ativo: boolean; noCabecalho?: boolean }) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      hrefEditar={noCabecalho ? undefined : `/admin/cartoes/${id}`}
      alternarAtivo={() => alternarAtivoCartao(id)}
      excluir={() => excluirCartao(id, noCabecalho)}
      avisoExclusao="O item do catálogo continua cadastrado."
    />
  );
}
