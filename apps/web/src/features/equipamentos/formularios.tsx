"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ImageOff, Upload } from "lucide-react";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { BotaoEnviar } from "@/ui/submit-button";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { ROTULO_TIPO_DADO, ROTULO_TIPO_EQUIPAMENTO, TIPOS_DE_DADO, TIPOS_DE_EQUIPAMENTO } from "./schema";

type AcaoDeFormulario = (estado: EstadoDoFormulario, form: FormData) => Promise<EstadoDoFormulario>;

function Rodape({ estado, rotulo, pendente }: { estado: EstadoDoFormulario; rotulo: string; pendente: boolean }) {
  return (
    <>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>{rotulo}</BotaoEnviar>
      </div>
    </>
  );
}

export function CaixaDeSelecao({
  name,
  rotulo,
  defaultChecked,
  ajuda,
}: {
  name: string;
  rotulo: string;
  defaultChecked?: boolean;
  ajuda?: string;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-grafite-700">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 rounded border-gray-300 accent-marca-600"
      />
      <span>
        {rotulo}
        {ajuda && <span className="block text-xs text-gray-500">{ajuda}</span>}
      </span>
    </label>
  );
}

/* ───────────── Equipamento (aba Geral e criação) ───────────── */

export function FormEquipamento({
  acao,
  categorias,
  valores,
  rotuloBotao,
  limparAoSalvar,
}: {
  acao: AcaoDeFormulario;
  categorias: { id: string; rotulo: string }[];
  valores?: {
    codigo: string;
    nome: string;
    descricao: string | null;
    tipo: string;
    categoriaId: string;
    isDemo: boolean;
  };
  rotuloBotao: string;
  limparAoSalvar?: boolean;
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok && limparAoSalvar) ref.current?.reset();
  }, [estado, limparAoSalvar]);
  const e = estado.erros ?? {};
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
        <Campo rotulo="Código" erro={e.codigo} ajuda="Único. Ex.: EXAUSTOR">
          <Input name="codigo" defaultValue={valores?.codigo} required maxLength={40} className="uppercase" />
        </Campo>
        <Campo rotulo="Nome do equipamento" erro={e.nome}>
          <Input name="nome" defaultValue={valores?.nome} required maxLength={120} />
        </Campo>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Categoria" erro={e.categoriaId}>
          <Select name="categoriaId" defaultValue={valores?.categoriaId ?? ""} required>
            <option value="" disabled>
              Escolha…
            </option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.rotulo}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Tipo" erro={e.tipo}>
          <Select name="tipo" defaultValue={valores?.tipo ?? "EQUIPAMENTO"}>
            {TIPOS_DE_EQUIPAMENTO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_EQUIPAMENTO[t]}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <Campo rotulo="Descrição" erro={e.descricao}>
        <Textarea name="descricao" defaultValue={valores?.descricao ?? ""} maxLength={1000} />
      </Campo>
      <CaixaDeSelecao
        name="isDemo"
        rotulo="Dado de exemplo (DEMO)"
        ajuda="Marque enquanto os dados não forem reais. Aparece com o selo DEMO."
        defaultChecked={valores?.isDemo}
      />
      <Rodape estado={estado} pendente={pendente} rotulo={rotuloBotao} />
    </form>
  );
}

/* ───────────── Características ───────────── */

const USA_OPCOES = new Set(["LISTA", "MULTIPLA"]);

export function FormNovaDefinicao({ acao }: { acao: AcaoDeFormulario }) {
  const [tipo, setTipo] = useState<string>("TEXTO");
  const { estado, onSubmit, pendente } = useFormulario(async (anterior: EstadoDoFormulario, form: FormData) => {
    const r = await acao(anterior, form);
    if (r.ok) setTipo("TEXTO");
    return r;
  });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);
  const e = estado.erros ?? {};
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Novo campo">
      <Campo rotulo="Nome do campo" erro={e.rotulo} ajuda="Ex.: Vazão, Diâmetro da hélice">
        <Input name="rotulo" required maxLength={60} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Tipo de dado" erro={e.tipoDado}>
          <Select name="tipoDado" value={tipo} onChange={(ev) => setTipo(ev.target.value)}>
            {TIPOS_DE_DADO.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO_DADO[t]}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo rotulo="Unidade" erro={e.unidade} ajuda="Opcional. Ex.: kW, m³/h">
          <Input name="unidade" maxLength={20} />
        </Campo>
      </div>
      {USA_OPCOES.has(tipo) && (
        <Campo rotulo="Opções" erro={e.opcoes} ajuda="Uma por linha.">
          <Textarea name="opcoes" rows={4} />
        </Campo>
      )}
      <CaixaDeSelecao name="obrigatorio" rotulo="Obrigatório nos modelos" />
      <Rodape estado={estado} pendente={pendente} rotulo="Adicionar campo" />
    </form>
  );
}

export function FormEdicaoDefinicao({
  acao,
  valores,
}: {
  acao: AcaoDeFormulario;
  valores: { rotulo: string; tipoDado: string; unidade: string | null; opcoes: string[]; obrigatorio: boolean };
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <Campo rotulo="Nome do campo" erro={e.rotulo}>
          <Input name="rotulo" defaultValue={valores.rotulo} required maxLength={60} />
        </Campo>
        <Campo rotulo="Unidade" erro={e.unidade}>
          <Input name="unidade" defaultValue={valores.unidade ?? ""} maxLength={20} />
        </Campo>
      </div>
      {USA_OPCOES.has(valores.tipoDado) && (
        <Campo rotulo="Opções" erro={e.opcoes} ajuda="Uma por linha. Modelos com opção removida deixam de ter esse valor ao salvar.">
          <Textarea name="opcoes" rows={4} defaultValue={valores.opcoes.join("\n")} />
        </Campo>
      )}
      <CaixaDeSelecao name="obrigatorio" rotulo="Obrigatório nos modelos" defaultChecked={valores.obrigatorio} />
      <Rodape estado={estado} pendente={pendente} rotulo="Salvar campo" />
    </form>
  );
}

export function BotaoDeAcao({
  acao,
  children,
  variante = "secundario",
  tamanho = "sm",
}: {
  acao: () => Promise<unknown>;
  children: React.ReactNode;
  variante?: "primario" | "secundario" | "fantasma" | "perigo";
  tamanho?: "sm" | "md";
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <Button
      type="button"
      variante={variante}
      tamanho={tamanho}
      disabled={pendente}
      onClick={() => iniciar(async () => void (await acao()))}
    >
      {pendente ? "Aguarde…" : children}
    </Button>
  );
}

/* ───────────── Modelos ───────────── */

export function FormNovoModelo({ acao }: { acao: AcaoDeFormulario }) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Novo modelo">
      <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
        <Campo rotulo="Código do modelo" erro={e.codigo}>
          <Input name="codigo" required maxLength={40} className="uppercase" />
        </Campo>
        <Campo rotulo="Nome do modelo" erro={e.nome}>
          <Input name="nome" required maxLength={120} />
        </Campo>
      </div>
      <Campo rotulo="Fabricante" erro={e.fabricante}>
        <Input name="fabricante" maxLength={80} />
      </Campo>
      <CaixaDeSelecao name="isDemo" rotulo="Dado de exemplo (DEMO)" />
      <Rodape estado={estado} pendente={pendente} rotulo="Criar modelo" />
    </form>
  );
}

export interface DefinicaoParaFormulario {
  chave: string;
  rotulo: string;
  tipoDado: string;
  unidade: string | null;
  opcoes: string[];
  obrigatorio: boolean;
}

function valorTexto(v: unknown) {
  if (typeof v === "number") return String(v).replace(".", ",");
  return typeof v === "string" ? v : "";
}

function CampoDeAtributo({
  d,
  valor,
  erro,
}: {
  d: DefinicaoParaFormulario;
  valor: unknown;
  erro?: string;
}) {
  const nome = `attr:${d.chave}`;
  const rotulo = `${d.rotulo}${d.unidade ? ` (${d.unidade})` : ""}${d.obrigatorio ? " *" : ""}`;
  if (d.tipoDado === "MULTIPLA") {
    const marcados = Array.isArray(valor) ? (valor as string[]) : [];
    return (
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm font-medium text-grafite-700">{rotulo}</legend>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {d.opcoes.map((o) => (
            <label key={o} className="flex items-center gap-1.5 text-sm text-grafite-700">
              <input
                type="checkbox"
                name={nome}
                value={o}
                defaultChecked={marcados.includes(o)}
                className="size-4 accent-marca-600"
              />
              {o}
            </label>
          ))}
        </div>
        {erro && <span className="text-xs text-red-600">{erro}</span>}
      </fieldset>
    );
  }
  return (
    <Campo rotulo={rotulo} erro={erro}>
      {d.tipoDado === "LISTA" ? (
        <Select name={nome} defaultValue={typeof valor === "string" ? valor : ""}>
          <option value="">(não informado)</option>
          {d.opcoes.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      ) : d.tipoDado === "BOOLEANO" ? (
        <Select name={nome} defaultValue={valor === true ? "sim" : valor === false ? "nao" : ""}>
          <option value="">(não informado)</option>
          <option value="sim">Sim</option>
          <option value="nao">Não</option>
        </Select>
      ) : (
        <Input
          name={nome}
          defaultValue={valorTexto(valor)}
          inputMode={d.tipoDado === "NUMERO" ? "decimal" : undefined}
          maxLength={200}
        />
      )}
    </Campo>
  );
}

export function FormModelo({
  acao,
  definicoes,
  valores,
}: {
  acao: AcaoDeFormulario;
  definicoes: DefinicaoParaFormulario[];
  valores: {
    codigo: string;
    nome: string;
    fabricante: string | null;
    descricao: string | null;
    isDemo: boolean;
    atributos: Record<string, unknown>;
  };
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const e = estado.erros ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <Campo rotulo="Código do modelo" erro={e.codigo}>
            <Input name="codigo" defaultValue={valores.codigo} required maxLength={40} className="uppercase" />
          </Campo>
          <Campo rotulo="Nome do modelo" erro={e.nome}>
            <Input name="nome" defaultValue={valores.nome} required maxLength={120} />
          </Campo>
        </div>
        <Campo rotulo="Fabricante" erro={e.fabricante}>
          <Input name="fabricante" defaultValue={valores.fabricante ?? ""} maxLength={80} />
        </Campo>
        <Campo rotulo="Descrição" erro={e.descricao}>
          <Textarea name="descricao" defaultValue={valores.descricao ?? ""} maxLength={1000} />
        </Campo>
        <CaixaDeSelecao name="isDemo" rotulo="Dado de exemplo (DEMO)" defaultChecked={valores.isDemo} />
      </section>
      <section aria-label="Características técnicas" className="flex flex-col gap-4 border-t border-gray-100 pt-5">
        <h2 className="font-medium text-grafite-900">Características técnicas</h2>
        {definicoes.length === 0 ? (
          <p className="text-sm text-gray-500">
            Este equipamento ainda não tem campos de características. Cadastre-os na aba Características do equipamento.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {definicoes.map((d) => (
              <CampoDeAtributo key={d.chave} d={d} valor={valores.atributos[d.chave]} erro={e[`attr:${d.chave}`]} />
            ))}
          </div>
        )}
      </section>
      <Rodape estado={estado} pendente={pendente} rotulo="Salvar modelo" />
    </form>
  );
}

/* ───────────── Imagem ───────────── */

export function FormImagem({
  acao,
  remover,
  url,
  textoAlternativo,
}: {
  acao: AcaoDeFormulario;
  remover: () => Promise<unknown>;
  url: string | null;
  textoAlternativo?: string | null;
}) {
  const [previa, setPrevia] = useState<string | null>(null);
  const { estado, onSubmit, pendente } = useFormulario(async (anterior: EstadoDoFormulario, form: FormData) => {
    const r = await acao(anterior, form);
    if (r.ok) setPrevia(null);
    return r;
  });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);
  useEffect(() => () => void (previa && URL.revokeObjectURL(previa)), [previa]);
  const mostrada = previa ?? url;
  return (
    <div className="grid gap-6 sm:grid-cols-[240px_1fr]">
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-card border border-gray-200 bg-gray-50">
        {mostrada ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mostrada} alt={textoAlternativo ?? "Imagem"} className="size-full object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-xs text-gray-400">
            <ImageOff className="size-6" />
            Sem imagem
          </div>
        )}
      </div>
      <form ref={ref} onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Enviar imagem">
        <Campo rotulo="Arquivo de imagem" erro={estado.erros?.arquivo} ajuda="JPG, PNG ou WebP, até 4 MB.">
          <input
            type="file"
            name="arquivo"
            accept="image/jpeg,image/png,image/webp"
            required
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              setPrevia(f ? URL.createObjectURL(f) : null);
            }}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-marca-700"
          />
        </Campo>
        <Campo rotulo="Texto alternativo" ajuda="Descreve a imagem para leitores de tela.">
          <Input name="textoAlternativo" defaultValue={textoAlternativo ?? ""} maxLength={200} />
        </Campo>
        {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
        <div className="flex gap-2">
          <BotaoEnviar pendente={pendente}>
            <Upload className="size-4" /> Enviar imagem
          </BotaoEnviar>
          {url && (
            <BotaoDeAcao acao={remover} variante="perigo" tamanho="md">
              Remover imagem
            </BotaoDeAcao>
          )}
        </div>
      </form>
    </div>
  );
}
