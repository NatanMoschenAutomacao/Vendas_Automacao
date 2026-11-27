"use client";
import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { equivalencia, type Imposto, type RegraComercial } from "@zanatta/engine";
import { Campo, Input, Select } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { AcoesDeLinha, BotaoIcone } from "@/ui/acoes-de-linha";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CaixaDeSelecao } from "@/features/equipamentos/formularios";
import { alternarAtivoServico, excluirPrecoDoItem, excluirServico, salvarImpostos } from "./actions";
import { normalizarDecimal, ROTULO_GRUPO, ROTULO_MODO } from "./schema";
import { paraCampo } from "./formato";

type Acao = (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;

export function FormRegraComercial({ acao, inicial }: { acao: Acao; inicial: RegraComercial | null }) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const [tipo, setTipo] = useState<RegraComercial["tipo"]>(inicial?.tipo ?? "markup");
  const [percentual, setPercentual] = useState(paraCampo(inicial?.percentual));
  const normal = normalizarDecimal(percentual);
  const eq = normal && normal !== "NaN" ? equivalencia({ tipo, percentual: normal }) : null;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Regra comercial">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Tipo da regra" erro={estado.erros?.tipo}>
          <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as RegraComercial["tipo"])}>
            <option value="markup">Markup sobre o custo</option>
            <option value="margem">Margem sobre a venda</option>
          </Select>
        </Campo>
        <Campo rotulo="Percentual da regra" erro={estado.erros?.percentual}>
          <Input name="percentual" inputMode="decimal" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
        </Campo>
      </div>
      <p className="text-sm text-gray-600" data-campo="equivalencia">
        {eq === null
          ? "Informe um percentual válido para ver a equivalência."
          : tipo === "margem"
            ? `Margem de ${percentual}% equivale a markup de ${eq.replace(".", ",")}%. Venda = custo ÷ (1 − margem).`
            : `Markup de ${percentual}% equivale a margem de ${eq.replace(".", ",")}%. Venda = custo × (1 + markup).`}
      </p>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Salvar regra comercial</BotaoEnviar>
      </div>
    </form>
  );
}

export function FormLimiteDeDesconto({ acao, inicial }: { acao: Acao; inicial: string }) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Limite de desconto do vendedor">
      <Campo rotulo="Limite de desconto do vendedor (%)" erro={estado.erros?.percentual} ajuda="Soma dos descontos percentuais por grupo. Acima disso, só o administrador técnico aplica.">
        <Input name="percentual" inputMode="decimal" defaultValue={paraCampo(inicial) || "0"} />
      </Campo>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Salvar limite</BotaoEnviar>
      </div>
    </form>
  );
}

let contador = 0;
const novoId = () => `imp-${Date.now().toString(36)}-${(contador++).toString(36)}`;

export function EditorDeImpostos({ inicial }: { inicial: Imposto[] }) {
  const [linhas, setLinhas] = useState(inicial.map((i) => ({ ...i, percentual: paraCampo(i.percentual) })));
  const [estado, setEstado] = useState<EstadoDoFormulario>({});
  const [pendente, iniciar] = useTransition();
  const mudar = (n: number, m: Partial<Imposto>) => setLinhas((l) => l.map((x, i) => (i === n ? { ...x, ...m } : x)));
  const salvar = () =>
    iniciar(async () => {
      const dados = linhas.map((l) => ({ ...l, percentual: normalizarDecimal(l.percentual) ?? "" }));
      setEstado(await salvarImpostos(JSON.stringify(dados)));
    });
  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Impostos">
      {linhas.length === 0 && <p className="text-sm text-gray-500">Nenhum imposto cadastrado.</p>}
      {linhas.map((l, n) => (
        <div key={l.id} className="grid items-end gap-2 sm:grid-cols-[1fr_10rem_8rem_auto]" data-imposto={n + 1}>
          <Campo rotulo={`Nome do imposto ${n + 1}`}>
            <Input value={l.nome} maxLength={80} onChange={(e) => mudar(n, { nome: e.target.value })} />
          </Campo>
          <Campo rotulo={`Grupo do imposto ${n + 1}`}>
            <Select value={l.grupo} onChange={(e) => mudar(n, { grupo: e.target.value as Imposto["grupo"] })}>
              {Object.entries(ROTULO_GRUPO).map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo={`Percentual do imposto ${n + 1}`}>
            <Input inputMode="decimal" value={l.percentual} onChange={(e) => mudar(n, { percentual: e.target.value })} />
          </Campo>
          <BotaoIcone titulo={`Remover imposto ${n + 1}`} perigo onClick={() => setLinhas((x) => x.filter((_, i) => i !== n))}>
            <Trash2 className="size-4" />
          </BotaoIcone>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variante="secundario" tamanho="sm" onClick={() => setLinhas((l) => [...l, { id: novoId(), nome: "", grupo: "material", percentual: "" }])}>
          <Plus className="size-4" /> Adicionar imposto
        </Button>
        <Button type="button" tamanho="sm" disabled={pendente} onClick={salvar}>
          Salvar impostos
        </Button>
      </div>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
    </div>
  );
}

export function FormNovoPreco({ acao, hoje }: { acao: Acao; hoje: string }) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const [modo, setModo] = useState<"venda_fixa" | "custo_regra">("venda_fixa");
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Novo preço">
      <Campo rotulo="Modo de preço" erro={e.modo} ajuda="Venda fixa usa o preço de venda e ignora a regra comercial. Nunca os dois.">
        <Select name="modo" value={modo} onChange={(ev) => setModo(ev.target.value as typeof modo)}>
          {Object.entries(ROTULO_MODO).map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </Select>
      </Campo>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Custo (R$)" erro={e.custo} ajuda={modo === "venda_fixa" ? "Opcional: usado só para a margem interna." : undefined}>
          <Input name="custo" inputMode="decimal" />
        </Campo>
        {modo === "venda_fixa" && (
          <Campo rotulo="Venda (R$)" erro={e.venda}>
            <Input name="venda" inputMode="decimal" />
          </Campo>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Vigente a partir de" erro={e.vigenteDesde}>
          <Input name="vigenteDesde" type="date" defaultValue={hoje} />
        </Campo>
        <Campo rotulo="Observação" erro={e.observacao}>
          <Input name="observacao" maxLength={300} />
        </Campo>
      </div>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>Registrar preço</BotaoEnviar>
      </div>
    </form>
  );
}

export function ExcluirPreco({ id, nome }: { id: string; nome: string }) {
  return <AcoesDeLinha nome={nome} excluir={excluirPrecoDoItem.bind(null, id)} avisoExclusao="O histórico perde este registro." />;
}

export function FormServico({
  acao,
  inicial,
}: {
  acao: Acao;
  inicial?: { codigo: string; descricao: string; unidade: string; fracionavel: boolean; valor: string | null; custo: string | null; isDemo: boolean };
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="@container flex flex-col gap-4" aria-label={inicial ? "Dados do serviço" : "Novo serviço"}>
      <div className="grid gap-3 @lg:grid-cols-[12rem_1fr]">
        <Campo rotulo="Código" erro={e.codigo}>
          <Input name="codigo" defaultValue={inicial?.codigo} maxLength={40} required />
        </Campo>
        <Campo rotulo="Descrição" erro={e.descricao}>
          <Input name="descricao" defaultValue={inicial?.descricao} maxLength={300} required />
        </Campo>
      </div>
      <div className="grid gap-3 @lg:grid-cols-3">
        <Campo rotulo="Unidade" erro={e.unidade} ajuda="Ex.: h, vb, km.">
          <Input name="unidade" defaultValue={inicial?.unidade ?? "h"} maxLength={10} required />
        </Campo>
        <Campo rotulo="Valor de venda (R$)" erro={e.valor} ajuda="Vazio = sem preço (pendência no orçamento).">
          <Input name="valor" inputMode="decimal" defaultValue={paraCampo(inicial?.valor)} />
        </Campo>
        <Campo rotulo="Custo (R$)" erro={e.custo} ajuda="Opcional. Só o administrador vê.">
          <Input name="custo" inputMode="decimal" defaultValue={paraCampo(inicial?.custo)} />
        </Campo>
      </div>
      <CaixaDeSelecao name="fracionavel" rotulo="Aceita quantidade fracionada (ex.: 1,5 h)" defaultChecked={inicial?.fracionavel ?? true} />
      <CaixaDeSelecao name="isDemo" rotulo="Dado de demonstração (DEMO)" defaultChecked={inicial?.isDemo ?? false} />
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>{inicial ? "Salvar serviço" : "Criar serviço"}</BotaoEnviar>
      </div>
    </form>
  );
}

export function AcoesDoServico({ id, nome, ativo, voltar }: { id: string; nome: string; ativo: boolean; voltar?: string }) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      hrefEditar={voltar ? undefined : `/admin/servicos/${id}`}
      alternarAtivo={alternarAtivoServico.bind(null, id)}
      excluir={excluirServico.bind(null, id, voltar)}
    />
  );
}
