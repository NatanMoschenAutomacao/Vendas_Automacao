"use client";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { Campo, Input, Select, Textarea } from "@/ui/input";
import { Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { BotaoEnviar } from "@/ui/submit-button";
import { AcoesDeLinha } from "@/ui/acoes-de-linha";
import type { EstadoDoFormulario } from "@/ui/form-status";
import { useFormulario } from "@/ui/use-formulario";
import { CaixaDeSelecao } from "@/features/equipamentos/formularios";
import { alternarAtivoItem, excluirItem, importarItens, type ResultadoDaImportacao } from "./actions";
import type { DadosDoItem } from "./schema";

export function FormItem({
  acao,
  categorias,
  inicial,
}: {
  acao: (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario>;
  categorias: { id: string; nome: string }[];
  inicial?: DadosDoItem;
}) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok && !inicial) ref.current?.reset();
  }, [estado, inicial]);
  const e = estado.erros ?? {};
  return (
    <form ref={ref} onSubmit={onSubmit} className="@container flex flex-col gap-4" aria-label={inicial ? "Editar item" : "Novo item"}>
      <div className="grid gap-4 @lg:grid-cols-[11rem_minmax(0,1fr)_6rem]">
        <Campo rotulo="Código interno" erro={e.codigo}>
          <Input name="codigo" defaultValue={inicial?.codigo} required maxLength={40} className="uppercase" />
        </Campo>
        <Campo rotulo="Descrição" erro={e.descricao}>
          <Input name="descricao" defaultValue={inicial?.descricao} required maxLength={300} />
        </Campo>
        <Campo rotulo="Unidade" erro={e.unidade} ajuda="pç, m, kg…">
          <Input name="unidade" defaultValue={inicial?.unidade ?? "pç"} required maxLength={10} />
        </Campo>
      </div>
      <div className="grid gap-4 @lg:grid-cols-3">
        <Campo rotulo="Fabricante" erro={e.fabricante}>
          <Input name="fabricante" defaultValue={inicial?.fabricante ?? ""} maxLength={120} />
        </Campo>
        <Campo rotulo="Código do fabricante" erro={e.codigoFabricante}>
          <Input name="codigoFabricante" defaultValue={inicial?.codigoFabricante ?? ""} maxLength={80} />
        </Campo>
        <Campo rotulo="Modelo" erro={e.modelo}>
          <Input name="modelo" defaultValue={inicial?.modelo ?? ""} maxLength={120} />
        </Campo>
      </div>
      <div className="grid gap-4 @lg:grid-cols-2">
        <Campo rotulo="Fornecedor" erro={e.fornecedor}>
          <Input name="fornecedor" defaultValue={inicial?.fornecedor ?? ""} maxLength={120} />
        </Campo>
        <Campo rotulo="Categoria" erro={e.categoriaId}>
          <Select name="categoriaId" defaultValue={inicial?.categoriaId ?? ""}>
            <option value="">Sem categoria</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Campo>
      </div>
      <CaixaDeSelecao name="fracionavel" rotulo="Aceita quantidade fracionada" ajuda="Para metros, quilos… Sem isso, a quantidade sempre arredonda para cima." defaultChecked={inicial?.fracionavel} />
      <CaixaDeSelecao name="isDemo" rotulo="Dado de demonstração (DEMO)" defaultChecked={inicial?.isDemo} />
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      <div>
        <BotaoEnviar pendente={pendente}>{inicial ? "Salvar item" : "Criar item"}</BotaoEnviar>
      </div>
    </form>
  );
}

export function AcoesDoItem({ id, nome, ativo }: { id: string; nome: string; ativo: boolean }) {
  return (
    <AcoesDeLinha
      nome={nome}
      ativo={ativo}
      hrefEditar={`/admin/componentes/${id}`}
      alternarAtivo={() => alternarAtivoItem(id)}
      excluir={() => excluirItem(id)}
      avisoExclusao="Itens usados por modelos ou regras não podem ser excluídos."
    />
  );
}

export function FormCategoriaDeComponente({ acao }: { acao: (e: EstadoDoFormulario, f: FormData) => Promise<EstadoDoFormulario> }) {
  const { estado, onSubmit, pendente } = useFormulario(acao);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);
  return (
    <form ref={ref} onSubmit={onSubmit} className="flex flex-col gap-2" aria-label="Nova categoria de componente">
      <div className="flex gap-2">
        <Input name="nome" aria-label="Nome da categoria" placeholder="Nova categoria" maxLength={80} required />
        <BotaoEnviar variante="secundario" pendente={pendente}>
          Criar
        </BotaoEnviar>
      </div>
      {(estado.erros?.nome || estado.mensagem) && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.erros?.nome ?? estado.mensagem}</Mensagem>}
    </form>
  );
}

export function FormImportacao() {
  const [estado, despachar, pendente] = useActionState(importarItens, {} as ResultadoDaImportacao);
  return (
    <form
      className="flex flex-col gap-3"
      aria-label="Importar itens"
      onSubmit={(e) => {
        e.preventDefault();
        const dados = new FormData(e.currentTarget);
        dados.set("modo", (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "simular");
        startTransition(() => despachar(dados));
      }}
    >
      <p className="text-sm text-gray-500">
        Copie as linhas da planilha (com a linha de títulos) e cole abaixo. Colunas: <code>codigo</code>, <code>descricao</code>, <code>unidade</code> e, se quiser,{" "}
        <code>fabricante</code>, <code>codigo_fabricante</code>, <code>modelo</code>, <code>fornecedor</code>, <code>categoria</code>, <code>fracionavel</code> (sim/não). Itens com
        código já cadastrado são atualizados.
      </p>
      <Textarea name="planilha" aria-label="Planilha" rows={8} className="font-mono text-xs" required />
      <CaixaDeSelecao name="isDemo" rotulo="Marcar itens novos como DEMO" />
      <div className="flex gap-2">
        <Button type="submit" variante="secundario" value="simular" disabled={pendente}>
          Simular
        </Button>
        <Button type="submit" value="importar" disabled={pendente}>
          {pendente ? "Aguarde…" : "Importar"}
        </Button>
      </div>
      {estado.mensagem && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
      {estado.resumo && (
        <div role="status" className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-grafite-800">
          {estado.resumo.simulado ? "Simulação: " : ""}
          {estado.resumo.novos} novo(s), {estado.resumo.atualizados} atualizado(s), {estado.resumo.erros.length} com erro.
          {estado.resumo.erros.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs text-red-700">
              {estado.resumo.erros.slice(0, 50).map((e) => (
                <li key={e.linha}>
                  Linha {e.linha}: {e.erro}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  );
}
