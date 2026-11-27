"use client";
import { useState, useTransition } from "react";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { Card, Mensagem } from "@/ui/card";
import { Button } from "@/ui/button";
import { devolverParaRascunho, emitirOrcamento, enviarParaValidacao, novaRevisao, validarOrcamento, type ResultadoDoStatus } from "./status";

type Status = "RASCUNHO" | "AGUARDANDO_VALIDACAO" | "VALIDADO" | "EMITIDO";

const EXPLICACAO: Record<Status, string> = {
  RASCUNHO: "Rascunho: salvo automaticamente. Os documentos saem como prévia.",
  AGUARDANDO_VALIDACAO: "Aguardando a validação técnica. O orçamento fica somente leitura.",
  VALIDADO: "Validado tecnicamente. Pronto para emitir.",
  EMITIDO: "Emitido: configuração, biblioteca e valores ficaram congelados nesta revisão.",
};

/** Situação do orçamento, ações de status e downloads dos documentos (Fase 10). */
export function SituacaoDoOrcamento({
  id,
  status,
  revisao,
  emitidoEm,
  podeValidar,
  verCusto,
}: {
  id: string;
  status: Status;
  revisao: number;
  emitidoEm: string | null;
  podeValidar: boolean;
  verCusto: boolean;
}) {
  const [pendente, iniciar] = useTransition();
  const [estado, setEstado] = useState<ResultadoDoStatus | null>(null);
  const rodar = (acao: (id: string) => Promise<ResultadoDoStatus>) => iniciar(async () => setEstado(await acao(id)));
  const base = `/orcamentos/${id}/documentos`;
  const link = "inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-grafite-800 hover:bg-gray-50";
  return (
    <Card className="mb-6 flex flex-col gap-3 p-4" role="region" aria-label="Situação e documentos">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-sm text-grafite-700" data-status={status}>
          <span className="font-medium">Revisão {revisao}.</span> {EXPLICACAO[status]}
          {emitidoEm && ` Emitido em ${emitidoEm}.`}
        </p>
        {status === "RASCUNHO" && (
          <>
            <Button type="button" tamanho="sm" variante="secundario" disabled={pendente} onClick={() => rodar(enviarParaValidacao)}>
              Enviar para validação
            </Button>
            {podeValidar && (
              <Button type="button" tamanho="sm" disabled={pendente} onClick={() => rodar(validarOrcamento)}>
                Validar
              </Button>
            )}
          </>
        )}
        {status === "AGUARDANDO_VALIDACAO" && (
          <>
            {podeValidar && (
              <Button type="button" tamanho="sm" disabled={pendente} onClick={() => rodar(validarOrcamento)}>
                Validar
              </Button>
            )}
            <Button type="button" tamanho="sm" variante="secundario" disabled={pendente} onClick={() => rodar(devolverParaRascunho)}>
              Voltar para rascunho
            </Button>
          </>
        )}
        {status === "VALIDADO" && (
          <>
            <Button type="button" tamanho="sm" disabled={pendente} onClick={() => rodar(emitirOrcamento)}>
              Emitir
            </Button>
            {podeValidar && (
              <Button type="button" tamanho="sm" variante="secundario" disabled={pendente} onClick={() => rodar(devolverParaRascunho)}>
                Voltar para rascunho
              </Button>
            )}
          </>
        )}
        {status === "EMITIDO" && (
          <Button type="button" tamanho="sm" variante="secundario" disabled={pendente} onClick={() => rodar(novaRevisao)}>
            Abrir nova revisão
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">{status === "EMITIDO" ? "Documentos:" : "Documentos (prévia):"}</span>
        <a className={link} href={`${base}/proposta.pdf`} download>
          <FileDown className="size-4" /> Proposta (PDF)
        </a>
        <a className={link} href={`${base}/listas.xlsx`} download>
          <FileSpreadsheet className="size-4" /> Listas e preços (Excel)
        </a>
        {verCusto && (
          <>
            <a className={link} href={`${base}/interno.pdf`} download>
              <FileDown className="size-4" /> Orçamento interno (PDF)
            </a>
            <a className={link} href={`${base}/interno.xlsx`} download>
              <FileSpreadsheet className="size-4" /> Orçamento interno (Excel)
            </a>
          </>
        )}
      </div>
      {estado && <Mensagem tipo={estado.ok ? "sucesso" : "erro"}>{estado.mensagem}</Mensagem>}
    </Card>
  );
}
