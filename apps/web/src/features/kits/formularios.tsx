"use client";
import { useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { resolverPerguntas, TIPOS_AUTOMATICOS, type Pergunta, type PerguntaDeModelo, type ValorDeResposta } from "@zanatta/engine";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { BotaoIcone } from "@/ui/acoes-de-linha";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CaixaDeSelecao } from "@/features/equipamentos/formularios";
import { CampoDeResposta } from "@/features/perguntas/campo-de-resposta";
import type { ItemDoKitEditado } from "./schema";

export function FormKit({
  acao,
  categorias,
  inicial,
  rotuloBotao,
}: {
  acao: (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;
  categorias: { id: string; rotulo: string }[];
  inicial?: { nome: string; descricao: string | null; categoriaId: string; isDemo: boolean };
  rotuloBotao: string;
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="@container flex flex-col gap-4">
      <div className="grid gap-4 @lg:grid-cols-2">
        <Campo rotulo="Nome" erro={e.nome} ajuda="Ex.: Estação completa.">
          <Input name="nome" defaultValue={inicial?.nome} required maxLength={120} />
        </Campo>
        <Campo rotulo="Categoria ou sistema" erro={e.categoriaId}>
          <Select name="categoriaId" defaultValue={inicial?.categoriaId ?? ""} required>
            <option value="">Escolha…</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo rotulo="Descrição" erro={e.descricao}>
        <Textarea name="descricao" defaultValue={inicial?.descricao ?? ""} maxLength={1000} />
      </Campo>
      <CaixaDeSelecao name="isDemo" rotulo="Dado de demonstração (DEMO)" defaultChecked={inicial?.isDemo} />
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>{rotuloBotao}</BotaoEnviar>
      </div>
    </form>
  );
}

export interface EquipamentoParaKit {
  id: string;
  nome: string;
  ativo: boolean;
  perguntas: Pergunta[];
  modelos: { id: string; nome: string; ativo: boolean; perguntas: PerguntaDeModelo[] }[];
}

/** Editor da lista de itens do kit, com quantidade e respostas padrão. */
export function EditorDeItensDoKit({
  inicial,
  equipamentos,
  salvar,
}: {
  inicial: ItemDoKitEditado[];
  equipamentos: EquipamentoParaKit[];
  salvar: (json: string) => Promise<EstadoDoFormulario>;
}) {
  const [itens, setItens] = useState(inicial);
  const [aberto, setAberto] = useState<number | null>(null);
  const [estado, setEstado] = useState<EstadoDoFormulario>({});
  const [pendente, iniciar] = useTransition();
  const porId = new Map(equipamentos.map((e) => [e.id, e]));
  const mudar = (n: number, m: Partial<ItemDoKitEditado>) => setItens((l) => l.map((x, i) => (i === n ? { ...x, ...m } : x)));

  return (
    <div className="flex flex-col gap-3" role="region" aria-label="Itens do kit">
      {itens.length === 0 && <p className="text-sm text-gray-500">O kit ainda não tem itens.</p>}
      {itens.map((item, n) => {
        const eq = porId.get(item.equipamentoId);
        const modelo = eq?.modelos.find((m) => m.id === item.modeloId);
        const perguntas = eq
          ? resolverPerguntas(eq.perguntas, modelo?.perguntas ?? []).perguntas.filter((p) => !TIPOS_AUTOMATICOS.includes(p.tipo))
          : [];
        const respondidas = Object.values(item.respostas).filter((v) => v !== null).length;
        return (
          <div key={n} className="rounded-lg border border-gray-200 p-3" data-item={n}>
            <div className="@container grid items-end gap-3 @lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_6rem_auto]">
              <Campo rotulo={`Equipamento do item ${n + 1}`} erro={estado.erros?.[`item-${n}`]}>
                <Select
                  value={item.equipamentoId}
                  onChange={(e) => mudar(n, { equipamentoId: e.target.value, modeloId: null, respostas: {} })}
                >
                  <option value="">Escolha…</option>
                  {equipamentos
                    .filter((e) => e.ativo || e.id === item.equipamentoId)
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nome}
                      </option>
                    ))}
                </Select>
              </Campo>
              <Campo rotulo={`Modelo do item ${n + 1}`}>
                <Select value={item.modeloId ?? ""} onChange={(e) => mudar(n, { modeloId: e.target.value || null })} disabled={!eq}>
                  <option value="">Vendedor escolhe</option>
                  {eq?.modelos
                    .filter((m) => m.ativo || m.id === item.modeloId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nome}
                      </option>
                    ))}
                </Select>
              </Campo>
              <Campo rotulo={`Quantidade do item ${n + 1}`}>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={item.quantidade}
                  onChange={(e) => mudar(n, { quantidade: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                />
              </Campo>
              <div className="flex items-center gap-1 pb-1">
                <BotaoIcone titulo={aberto === n ? "Fechar respostas padrão" : "Respostas padrão"} onClick={() => setAberto(aberto === n ? null : n)} disabled={!eq}>
                  {aberto === n ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </BotaoIcone>
                <BotaoIcone titulo={`Remover item ${n + 1}`} perigo onClick={() => setItens((l) => l.filter((_, i) => i !== n))}>
                  <Trash2 className="size-4" />
                </BotaoIcone>
              </div>
            </div>
            {respondidas > 0 && aberto !== n && <p className="mt-1 text-xs text-gray-500">{respondidas} resposta(s) padrão</p>}
            {aberto === n && eq && (
              <div className="mt-3 flex flex-col gap-3 border-t border-gray-100 pt-3">
                {perguntas.length === 0 && <p className="text-sm text-gray-500">Este equipamento não tem perguntas.</p>}
                {perguntas.map((p) => (
                  <CampoDeResposta
                    key={p.chave}
                    pergunta={{ ...p, obrigatoria: false }}
                    opcoes={p.opcoes}
                    valor={item.respostas[p.chave] as ValorDeResposta | null | undefined}
                    onChange={(v) => mudar(n, { respostas: { ...item.respostas, [p.chave]: v } })}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variante="secundario"
          type="button"
          onClick={() => {
            setItens((l) => [...l, { equipamentoId: "", modeloId: null, quantidade: 1, respostas: {} }]);
            setAberto(null);
          }}
        >
          <Plus className="size-4" /> Adicionar item
        </Button>
        <Button
          type="button"
          disabled={pendente}
          onClick={() => iniciar(async () => setEstado(await salvar(JSON.stringify(itens))))}
        >
          {pendente ? "Aguarde…" : "Salvar itens"}
        </Button>
      </div>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
    </div>
  );
}
