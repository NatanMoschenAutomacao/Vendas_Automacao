"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { AcoesDeLinha, BotaoIcone } from "@/ui/acoes-de-linha";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CaixaDeSelecao } from "@/features/equipamentos/formularios";
import { alternarAtivoControlador, excluirControlador } from "./actions";
import { ROTULO_TIPO, TIPOS, type SaidaEditada, type TipoDoBanco } from "./schema";

type Acao = (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;

export function FormNovoControlador({ acao, itens }: { acao: Acao; itens: { id: string; codigo: string; descricao: string }[] }) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Novo controlador">
      <Campo rotulo="Item do catálogo" erro={e.itemId} ajuda="Cadastre o item em Componentes elétricos antes. Preço e lista de materiais usam o item.">
        <Select name="itemId" defaultValue="" required>
          <option value="">Escolha…</option>
          {itens.map((i) => (
            <option key={i.id} value={i.id}>
              {i.codigo} — {i.descricao}
            </option>
          ))}
        </Select>
      </Campo>
      <Campo rotulo="Tipo de controlador" erro={e.tipo}>
        <Select name="tipo" defaultValue="DIGITAL">
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO[t]}
            </option>
          ))}
        </Select>
      </Campo>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Criar controlador</BotaoEnviar>
      </div>
    </form>
  );
}

export function FormControlador({
  acao,
  inicial,
}: {
  acao: Acao;
  inicial: {
    tipo: TipoDoBanco;
    alimentacao: string | null;
    tensoes: number[];
    protocolos: string[];
    observacoes: string | null;
    barramento: string | null;
    maxModulos: number | null;
    consumoMaxBarramento: number | null;
    isDemo: boolean;
  };
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="@container flex flex-col gap-4" aria-label="Dados do controlador">
      <div className="grid gap-4 @lg:grid-cols-2">
        <Campo rotulo="Tipo de controlador" erro={e.tipo}>
          <Select name="tipo" defaultValue={inicial.tipo}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Alimentação" erro={e.alimentacao} ajuda="Como consta na ficha técnica.">
          <Input name="alimentacao" defaultValue={inicial.alimentacao ?? ""} maxLength={120} />
        </Campo>
        <Campo rotulo="Tensões aceitas (V)" erro={e.tensoes} ajuda="Separadas por vírgula. Vazio = não verificar.">
          <Input name="tensoes" defaultValue={inicial.tensoes.join(", ")} maxLength={200} />
        </Campo>
        <Campo rotulo="Protocolos" erro={e.protocolos} ajuda="Ex.: Modbus RTU, Ethernet.">
          <Input name="protocolos" defaultValue={inicial.protocolos.join(", ")} maxLength={1000} />
        </Campo>
      </div>
      <fieldset className="grid gap-4 @lg:grid-cols-3">
        <legend className="mb-2 text-sm font-medium text-grafite-900">Expansão por cartões</legend>
        <Campo rotulo="Barramento" erro={e.barramento} ajuda="Cartões de outro barramento não entram.">
          <Input name="barramento" defaultValue={inicial.barramento ?? ""} maxLength={60} />
        </Campo>
        <Campo rotulo="Máximo de módulos" erro={e.maxModulos} ajuda={`Vazio = até 8 na busca.`}>
          <Input name="maxModulos" inputMode="numeric" defaultValue={inicial.maxModulos ?? ""} />
        </Campo>
        <Campo rotulo="Consumo máximo do barramento (mA)" erro={e.consumoMaxBarramento} ajuda="Vazio = não verificar.">
          <Input name="consumoMaxBarramento" inputMode="numeric" defaultValue={inicial.consumoMaxBarramento ?? ""} />
        </Campo>
      </fieldset>
      <Campo rotulo="Observações" erro={e.observacoes}>
        <Textarea name="observacoes" defaultValue={inicial.observacoes ?? ""} maxLength={2000} />
      </Campo>
      <CaixaDeSelecao name="isDemo" rotulo="Dado de demonstração (DEMO)" defaultChecked={inicial.isDemo} />
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Salvar controlador</BotaoEnviar>
      </div>
    </form>
  );
}

export function EditorDeRecursosIntegrados({
  tipos,
  inicial,
  salvar,
  sufixo = "integradas",
  rotulo = "Recursos integrados",
}: {
  tipos: { id: string; codigo: string; nome: string }[];
  inicial: Record<string, number>;
  salvar: (json: string) => Promise<EstadoDoFormulario>;
  sufixo?: string;
  rotulo?: string;
}) {
  const [valores, setValores] = useState(inicial);
  const [estado, setEstado] = useState<EstadoDoFormulario>({});
  const [pendente, iniciar] = useTransition();
  if (tipos.length === 0) return <p className="text-sm text-gray-500">Cadastre os tipos de recurso em Recursos de automação.</p>;
  return (
    <div className="flex flex-col gap-3" role="group" aria-label={rotulo}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tipos.map((t) => (
          <Campo key={t.id} rotulo={`${t.codigo} ${sufixo}`}>
            <Input
              type="number"
              min={0}
              step={1}
              value={valores[t.id] ?? 0}
              title={t.nome}
              onChange={(e) => setValores((v) => ({ ...v, [t.id]: Math.max(0, Math.trunc(Number(e.target.value) || 0)) }))}
            />
          </Campo>
        ))}
      </div>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <Button type="button" variante="secundario" disabled={pendente} onClick={() => iniciar(async () => setEstado(await salvar(JSON.stringify(valores))))}>
          {pendente ? "Aguarde…" : "Salvar recursos"}
        </Button>
      </div>
    </div>
  );
}

export function EditorDeSaidas({
  funcoes,
  inicial,
  salvar,
}: {
  funcoes: { id: string; nome: string }[];
  inicial: SaidaEditada[];
  salvar: (json: string) => Promise<EstadoDoFormulario>;
}) {
  const [saidas, setSaidas] = useState(inicial);
  const [estado, setEstado] = useState<EstadoDoFormulario>({});
  const [pendente, iniciar] = useTransition();
  const mudar = (n: number, m: Partial<SaidaEditada>) => setSaidas((l) => l.map((s, i) => (i === n ? { ...s, ...m } : s)));
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Saídas funcionais">
      {saidas.length === 0 && <p className="text-sm text-gray-500">Nenhuma saída funcional cadastrada.</p>}
      {saidas.map((s, n) => (
        <div key={s.id ?? `nova-${n}`} className="@container rounded-lg border border-gray-200 p-3" data-saida={n}>
          <div className="grid items-end gap-3 @md:grid-cols-[8rem_minmax(0,1fr)_auto]">
            <Campo rotulo={`Código da saída ${n + 1}`}>
              <Input value={s.codigo} maxLength={20} onChange={(e) => mudar(n, { codigo: e.target.value.toUpperCase() })} />
            </Campo>
            <Campo rotulo={`Descrição da saída ${n + 1}`}>
              <Input value={s.descricao ?? ""} maxLength={200} onChange={(e) => mudar(n, { descricao: e.target.value })} />
            </Campo>
            <div className="pb-1">
              <BotaoIcone titulo={`Remover saída ${n + 1}`} perigo onClick={() => setSaidas((l) => l.filter((_, i) => i !== n))}>
                <Trash2 className="size-4" />
              </BotaoIcone>
            </div>
          </div>
          <fieldset className="mt-2">
            <legend className="text-xs text-gray-500">Funções suportadas pela saída {n + 1}</legend>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {funcoes.map((f) => (
                <label key={f.id} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    className="accent-marca-600"
                    checked={s.funcoes.includes(f.id)}
                    onChange={(e) => mudar(n, { funcoes: e.target.checked ? [...s.funcoes, f.id] : s.funcoes.filter((x) => x !== f.id) })}
                  />
                  {f.nome}
                </label>
              ))}
              {funcoes.length === 0 && <span className="text-xs text-gray-500">Cadastre as funções em Funções de controle.</span>}
            </div>
          </fieldset>
        </div>
      ))}
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variante="secundario"
          onClick={() => setSaidas((l) => [...l, { id: null, codigo: `SP${l.length + 1}`, descricao: null, funcoes: [] }])}
        >
          <Plus className="size-4" /> Adicionar saída
        </Button>
        <Button type="button" disabled={pendente} onClick={() => iniciar(async () => setEstado(await salvar(JSON.stringify(saidas))))}>
          {pendente ? "Aguarde…" : "Salvar saídas"}
        </Button>
      </div>
    </div>
  );
}

export function FormModelosCompativeis({
  acao,
  equipamentos,
  marcados,
}: {
  acao: Acao;
  equipamentos: { id: string; nome: string; modelos: { id: string; nome: string; codigo: string }[] }[];
  marcados: string[];
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" aria-label="Modelos compatíveis">
      <p className="text-sm text-gray-500">
        Sem nenhum modelo marcado, o controlador é aceito com um aviso para conferência técnica.
      </p>
      {equipamentos.map((e) => (
        <fieldset key={e.id}>
          <legend className="text-sm font-medium text-grafite-800">{e.nome}</legend>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {e.modelos.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name="modelos" value={m.id} defaultChecked={marcados.includes(m.id)} className="accent-marca-600" />
                {m.nome} <span className="text-xs text-gray-400">{m.codigo}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar variante="secundario" pendente={pendente}>
          Salvar compatibilidade
        </BotaoEnviar>
      </div>
    </form>
  );
}

export function AcoesDoControlador({ id, nome, ativo, noCabecalho }: { id: string; nome: string; ativo: boolean; noCabecalho?: boolean }) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      hrefEditar={noCabecalho ? undefined : `/admin/controladores/${id}`}
      alternarAtivo={() => alternarAtivoControlador(id)}
      excluir={() => excluirControlador(id, noCabecalho)}
      avisoExclusao="O item do catálogo continua cadastrado."
    />
  );
}
