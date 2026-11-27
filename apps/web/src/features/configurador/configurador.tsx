"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  CircleCheck,
  Copy,
  FolderOpen,
  ImageOff,
  Layers,
  Package,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  adicionarEquipamento,
  aplicarKit,
  atualizarInstancia,
  calcular,
  duplicarInstancia,
  quantidadePorEquipamento,
  removerInstancia,
  resolverPerguntas,
  responder,
  valorAoEscolherOpcao,
  type ConfiguracaoDoProjeto,
  type Pendencia,
} from "@zanatta/engine";
import { cn } from "@/lib/cn";
import { Badge, Card } from "@/ui/card";
import { Button } from "@/ui/button";
import { Input, Select } from "@/ui/input";
import { BotaoIcone } from "@/ui/acoes-de-linha";
import { CampoDeResposta } from "@/features/perguntas/campo-de-resposta";
import { salvarRascunho } from "@/features/orcamentos/actions";
import { ImagemComHotspots } from "./imagem-com-hotspots";
import { PainelDeEstrutura, PainelDeGrupos, ResumoDaEstrutura } from "./estrutura";
import { PainelDeMateriais } from "./materiais";
import { PainelDeControladores } from "./controladores";
import type {
  BibliotecaDoConfigurador,
  CategoriaDoConfigurador,
  EquipamentoDoConfigurador,
  HotspotDoConfigurador,
  KitDoConfigurador,
} from "./tipos";

const ROTULO_TIPO = { EQUIPAMENTO: "Equipamento", SENSOR: "Sensor", ACESSORIO: "Acessório" } as const;
const ROTULO_GRAVIDADE = { impeditiva: "Impeditiva", advertencia: "Advertência", informativa: "Informativa" } as const;
const ESPERA_DO_SALVAMENTO = 700;

type EstadoDoSalvamento = { tipo: "salvo"; em: Date | null } | { tipo: "pendente" } | { tipo: "salvando" } | { tipo: "erro"; mensagem: string };

const novoId = () => crypto.randomUUID();

export function Configurador({
  orcamentoId,
  editavel,
  biblioteca,
  inicial,
  salvoEm,
  podeAjustarReserva = false,
}: {
  orcamentoId: string;
  editavel: boolean;
  podeAjustarReserva?: boolean;
  biblioteca: BibliotecaDoConfigurador;
  inicial: ConfiguracaoDoProjeto;
  salvoEm: string | null;
}) {
  const { snapshot } = biblioteca;
  const [config, setConfig] = useState(inicial);
  const [selecionada, setSelecionada] = useState<string | null>(inicial.instancias[0]?.id ?? null);
  const [categoriaAtual, setCategoriaAtual] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [aba, setAba] = useState<"itens" | "estrutura" | "grupos" | "controladores" | "materiais">("itens");
  const [salvamento, setSalvamento] = useState<EstadoDoSalvamento>({ tipo: "salvo", em: salvoEm ? new Date(salvoEm) : null });

  const resultado = useMemo(() => calcular(config, snapshot), [config, snapshot]);
  const porEquipamento = useMemo(() => quantidadePorEquipamento(config), [config]);
  const equipamentos = useMemo(() => new Map(biblioteca.equipamentos.map((e) => [e.id, e])), [biblioteca.equipamentos]);

  /* ───────────── Rascunho automático ───────────── */
  const salvoRef = useRef(JSON.stringify(inicial));
  const pendenteRef = useRef(false);

  const mudar = useCallback(
    (f: (c: ConfiguracaoDoProjeto) => ConfiguracaoDoProjeto) => {
      if (!editavel) return;
      setConfig(f);
      setSalvamento({ tipo: "pendente" });
    },
    [editavel],
  );

  useEffect(() => {
    const json = JSON.stringify(config);
    if (json === salvoRef.current) return;
    pendenteRef.current = true;
    const t = setTimeout(async () => {
      setSalvamento({ tipo: "salvando" });
      try {
        const r = await salvarRascunho(orcamentoId, json);
        if (r.ok) {
          salvoRef.current = json;
          pendenteRef.current = false;
          setSalvamento({ tipo: "salvo", em: new Date(r.salvoEm) });
        } else setSalvamento({ tipo: "erro", mensagem: r.erro });
      } catch {
        setSalvamento({ tipo: "erro", mensagem: "Sem conexão com o servidor. Tentaremos de novo na próxima alteração." });
      }
    }, ESPERA_DO_SALVAMENTO);
    return () => clearTimeout(t);
  }, [config, orcamentoId]);

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (pendenteRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, []);

  /* ───────────── Ações do catálogo ───────────── */
  function adicionar(equipamentoId: string, modeloId?: string | null) {
    const r = adicionarEquipamento(config, snapshot, equipamentoId, novoId, modeloId);
    if (!r.instancia) return setAviso("Esse equipamento não está disponível.");
    mudar(() => r.config);
    setSelecionada(r.instancia.id);
    setAviso(`${equipamentos.get(equipamentoId)?.nome ?? "Equipamento"} adicionado ao projeto.`);
  }

  function aplicar(kit: KitDoConfigurador) {
    const r = aplicarKit(config, snapshot, kit, novoId);
    mudar(() => r.config);
    if (r.adicionadas[0]) setSelecionada(r.adicionadas[0].id);
    setAviso(
      r.ignorados.length
        ? `Kit "${kit.nome}" aplicado. ${r.ignorados.length} item(ns) indisponível(is) foram ignorados.`
        : `Kit "${kit.nome}" aplicado: ${r.adicionadas.length} item(ns) adicionados.`,
    );
  }

  /** Instância onde um hotspot de pergunta/opção atua: a selecionada, se for do equipamento; senão a primeira. */
  function instanciaPara(equipamentoId: string) {
    const sel = config.instancias.find((i) => i.id === selecionada);
    if (sel?.equipamentoId === equipamentoId) return sel;
    return config.instancias.find((i) => i.equipamentoId === equipamentoId) ?? null;
  }

  function clicarHotspot(h: HotspotDoConfigurador, equipamentoDono: string | null) {
    if (!editavel) return;
    if (h.alvoTipo === "EQUIPAMENTO") return adicionar(h.alvoId);
    if (h.alvoTipo === "MODELO") {
      const eq = biblioteca.equipamentos.find((e) => e.modelos.some((m) => m.id === h.alvoId));
      if (!eq) return setAviso("Esse modelo não está disponível.");
      const inst = equipamentoDono === eq.id ? instanciaPara(eq.id) : null;
      if (inst) {
        mudar((c) => atualizarInstancia(c, inst.id, { modeloId: h.alvoId }));
        setSelecionada(inst.id);
        return setAviso(`Modelo alterado para ${eq.modelos.find((m) => m.id === h.alvoId)?.nome}.`);
      }
      return adicionar(eq.id, h.alvoId);
    }
    if (h.alvoTipo === "KIT") {
      const kit = biblioteca.kits.find((k) => k.id === h.alvoId);
      return kit ? aplicar(kit) : setAviso("Esse kit não está disponível.");
    }
    if (!equipamentoDono) return;
    let inst = instanciaPara(equipamentoDono);
    let base = config;
    if (!inst) {
      const r = adicionarEquipamento(config, snapshot, equipamentoDono, novoId);
      if (!r.instancia) return setAviso("Esse equipamento não está disponível.");
      inst = r.instancia;
      base = r.config;
    }
    setSelecionada(inst.id);
    if (h.alvoTipo === "PERGUNTA") {
      if (base !== config) mudar(() => base);
      requestAnimationFrame(() => document.getElementById(`resp-${h.alvoId}`)?.focus());
      return;
    }
    const eq = snapshot.equipamentos?.[equipamentoDono];
    const modelo = eq?.modelos.find((m) => m.id === inst.modeloId);
    const pergunta = eq && resolverPerguntas(eq.perguntas, modelo?.perguntas ?? []).perguntas.find((p) => p.chave === h.alvoId);
    if (!pergunta || h.alvoValor == null) return setAviso("Essa pergunta não se aplica ao modelo escolhido.");
    const id = inst.id;
    const novo = valorAoEscolherOpcao(pergunta, inst.respostas?.[pergunta.chave] ?? pergunta.padrao, h.alvoValor);
    mudar(() => responder(base, id, pergunta.chave, novo));
  }

  /* ───────────── Navegação do catálogo ───────────── */
  const filhas = (paiId: string | null) => biblioteca.categorias.filter((c) => c.paiId === paiId);
  const temConteudo = useMemo(() => {
    const memo = new Map<string, boolean>();
    const visitar = (id: string): boolean => {
      if (memo.has(id)) return memo.get(id)!;
      const direto =
        biblioteca.equipamentos.some((e) => e.ativo && e.categoriaId === id) ||
        biblioteca.kits.some((k) => k.categoriaId === id) ||
        biblioteca.imagens.some((i) => i.categoriaId === id);
      const r = direto || biblioteca.categorias.some((c) => c.paiId === id && visitar(c.id));
      memo.set(id, r);
      return r;
    };
    return visitar;
  }, [biblioteca]);

  const trilha: CategoriaDoConfigurador[] = [];
  for (let c = biblioteca.categorias.find((x) => x.id === categoriaAtual); c; c = biblioteca.categorias.find((x) => x.id === c!.paiId)) trilha.unshift(c);
  const subcategorias = filhas(categoriaAtual).filter((c) => temConteudo(c.id));
  const equipamentosAqui = categoriaAtual ? biblioteca.equipamentos.filter((e) => e.ativo && e.categoriaId === categoriaAtual) : [];
  const kitsAqui = categoriaAtual ? biblioteca.kits.filter((k) => k.categoriaId === categoriaAtual) : [];
  const imagensAqui = categoriaAtual ? biblioteca.imagens.filter((i) => i.categoriaId === categoriaAtual) : [];

  const instancia = config.instancias.find((i) => i.id === selecionada) ?? null;
  const nomeDaInstancia = (id?: string) => {
    const i = config.instancias.find((x) => x.id === id);
    return i ? (equipamentos.get(i.equipamentoId)?.nome ?? "Equipamento removido") : null;
  };
  /** Nome e aba de onde corrigir uma pendência. */
  const ondeCorrigir = (id?: string): { nome: string; aba: typeof aba } | null => {
    if (!id) return null;
    const inst = nomeDaInstancia(id);
    if (inst) return { nome: inst, aba: "itens" };
    const grupo = config.grupos?.find((g) => g.id === id);
    if (grupo) return { nome: `Grupo ${grupo.nome}`, aba: "grupos" };
    const painel = config.paineis?.find((p) => p.id === id);
    if (painel) return { nome: `Painel ${painel.identificacao}`, aba: "estrutura" };
    const setor = config.setores?.find((x) => x.id === id);
    if (setor) return { nome: `Setor ${setor.nome}`, aba: "estrutura" };
    if (config.ajustes?.some((a) => a.id === id)) return { nome: "Ajuste manual", aba: "materiais" };
    const controlador = config.controladores?.find((x) => x.id === id);
    if (controlador) return { nome: controlador.nome, aba: "controladores" };
    return null;
  };
  const pendenciasPorInstancia = new Map<string, Pendencia[]>();
  for (const p of resultado.pendencias) {
    if (!p.referencia) continue;
    pendenciasPorInstancia.set(p.referencia, [...(pendenciasPorInstancia.get(p.referencia) ?? []), p]);
  }
  const impeditivas = resultado.pendencias.filter((p) => p.gravidade === "impeditiva").length;

  const cartaoDePendencias = (
          <Card className="overflow-hidden" role="region" aria-label="Pendências">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="font-medium text-grafite-900">Pendências</h2>
              {impeditivas > 0 ? (
                <Badge tom="aviso">{impeditivas} impeditiva(s)</Badge>
              ) : (
                <Badge tom="marca">Nenhuma impeditiva</Badge>
              )}
            </div>
            {resultado.pendencias.length === 0 ? (
              <p className="px-4 py-4 text-sm text-gray-500">Nenhuma pendência.</p>
            ) : (
              <ul className="flex flex-col">
                {resultado.pendencias.map((p, n) => (
                  <li key={n} className="border-b border-gray-100 last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        const onde = ondeCorrigir(p.referencia);
                        if (!onde) return;
                        setAba(onde.aba);
                        if (onde.aba === "itens") setSelecionada(p.referencia!);
                      }}
                      className="flex w-full items-start gap-2 px-4 py-2 text-left text-sm hover:bg-gray-50"
                    >
                      <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", p.gravidade === "impeditiva" ? "text-red-600" : "text-amber-600")} />
                      <span className="min-w-0 flex-1">
                        <span className="text-grafite-800">{p.mensagem}</span>
                        <span className="block text-xs text-gray-500">
                          {ROTULO_GRAVIDADE[p.gravidade]}
                          {ondeCorrigir(p.referencia) && ` · ${ondeCorrigir(p.referencia)!.nome}`}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <IndicadorDeSalvamento estado={salvamento} editavel={editavel} />
        {aviso && (
          <p role="status" className="rounded-lg bg-marca-50 px-3 py-1.5 text-sm text-marca-700">
            {aviso}
          </p>
        )}
      </div>

      <ResumoDaEstrutura estrutura={resultado.estrutura} />

      <nav className="flex flex-wrap gap-1 border-b border-gray-200" aria-label="Etapas do configurador">
        {(
          [
            ["itens", "Equipamentos"],
            ["estrutura", "Ambientes e painéis"],
            ["grupos", "Grupos de controle"],
            ["controladores", "Controladores"],
            ["materiais", "Materiais e I/O"],
          ] as const
        ).map(([id, titulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            aria-current={aba === id ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium",
              aba === id ? "border-marca-600 text-marca-700" : "border-transparent text-gray-500 hover:text-grafite-800",
            )}
          >
            {titulo}
          </button>
        ))}
      </nav>

      {aba === "estrutura" && (
        <PainelDeEstrutura
          config={config}
          mudar={mudar}
          biblioteca={biblioteca}
          estrutura={resultado.estrutura}
          editavel={editavel}
          nomeDaInstancia={(id) => nomeDaInstancia(id) ?? "item"}
        />
      )}
      {aba === "grupos" && (
        <PainelDeGrupos
          config={config}
          mudar={mudar}
          biblioteca={biblioteca}
          estrutura={resultado.estrutura}
          editavel={editavel}
          nomeDaInstancia={(id) => nomeDaInstancia(id) ?? "item"}
        />
      )}
      {aba === "controladores" && (
        <PainelDeControladores
          config={config}
          mudar={mudar}
          biblioteca={biblioteca}
          resultado={resultado.controladores}
          editavel={editavel}
          podeAjustarReserva={podeAjustarReserva}
          nomeDaInstancia={(id) => nomeDaInstancia(id) ?? "item"}
        />
      )}
      {aba === "materiais" && (
        <PainelDeMateriais
          config={config}
          mudar={mudar}
          biblioteca={biblioteca}
          materiais={resultado.materiais}
          editavel={editavel}
          nomeDaInstancia={(id) => nomeDaInstancia(id) ?? "item"}
        />
      )}
      {aba !== "itens" && cartaoDePendencias}

      <div className={cn("grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,5fr)_minmax(0,4fr)]", aba !== "itens" && "xl:grid-cols-1 2xl:grid-cols-1")}>
        {/* ───────── Catálogo ───────── */}
        <section aria-label="Catálogo" className={cn("flex min-w-0 flex-col gap-4", aba !== "itens" && "hidden")}>
          <nav aria-label="Trilha do catálogo" className="flex flex-wrap items-center gap-1 text-sm">
            <button type="button" onClick={() => setCategoriaAtual(null)} className={cn("rounded px-1.5 py-0.5 hover:bg-gray-100", !categoriaAtual && "font-medium text-grafite-900")}>
              Catálogo
            </button>
            {trilha.map((c) => (
              <span key={c.id} className="flex items-center gap-1">
                <ChevronRight className="size-3.5 text-gray-300" />
                <button type="button" onClick={() => setCategoriaAtual(c.id)} className={cn("rounded px-1.5 py-0.5 hover:bg-gray-100", c.id === categoriaAtual && "font-medium text-grafite-900")}>
                  {c.nome}
                </button>
              </span>
            ))}
          </nav>

          {subcategorias.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
              {subcategorias.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaAtual(c.id)}
                  className="group flex items-center gap-3 rounded-card border border-gray-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-marca-500"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-marca-50 text-marca-700">
                    <FolderOpen className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-grafite-900">{c.nome}</span>
                    {c.descricao && <span className="line-clamp-2 text-xs text-gray-500">{c.descricao}</span>}
                  </span>
                  <ChevronRight className="size-4 text-gray-300 group-hover:text-marca-600" />
                </button>
              ))}
            </div>
          )}

          {!categoriaAtual && subcategorias.length === 0 && (
            <Card className="px-6 py-12 text-center text-sm text-gray-500">
              A biblioteca ainda não tem equipamentos ativos. Peça à equipe de automação para cadastrá-los.
            </Card>
          )}

          {imagensAqui.map((img) => (
            <Card key={img.id} className="p-4">
              <ImagemComHotspots
                imagem={img}
                aoClicar={(h) => clicarHotspot(h, null)}
                selo={(h) => (h.alvoTipo === "EQUIPAMENTO" && porEquipamento[h.alvoId] ? String(porEquipamento[h.alvoId]) : null)}
              />
            </Card>
          ))}

          {kitsAqui.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">Conjuntos padrão</h2>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {kitsAqui.map((k) => (
                  <CardDoKit key={k.id} kit={k} equipamentos={equipamentos} editavel={editavel} aoAplicar={() => aplicar(k)} />
                ))}
              </div>
            </div>
          )}

          {equipamentosAqui.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-xs font-medium uppercase tracking-wide text-gray-500">Equipamentos</h2>
              <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
                {equipamentosAqui.map((e) => (
                  <CardDoEquipamento key={e.id} e={e} quantidade={porEquipamento[e.id] ?? 0} editavel={editavel} aoAdicionar={() => adicionar(e.id)} />
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ───────── Projeto ───────── */}
        <section aria-label="Projeto" className={cn("flex min-w-0 flex-col gap-4", aba !== "itens" && "hidden")}>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
              <h2 className="font-medium text-grafite-900">Itens do projeto</h2>
              <span className="text-xs text-gray-500">
                {config.instancias.length} {config.instancias.length === 1 ? "item" : "itens"}
              </span>
            </div>
            {config.instancias.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-500">Escolha equipamentos ou kits no catálogo para montar o projeto.</p>
            )}
            <ul aria-label="Itens do projeto">
              {config.instancias.map((i) => {
                const e = equipamentos.get(i.equipamentoId);
                const m = e?.modelos.find((x) => x.id === i.modeloId);
                const pend = pendenciasPorInstancia.get(i.id) ?? [];
                return (
                  <li key={i.id} className="border-b border-gray-100 last:border-0">
                    <button
                      type="button"
                      onClick={() => setSelecionada(i.id)}
                      aria-current={i.id === selecionada ? "true" : undefined}
                      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50", i.id === selecionada && "bg-marca-50/60")}
                    >
                      <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
                        {(m?.imagemUrl ?? e?.imagemUrl) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={(m?.imagemUrl ?? e?.imagemUrl)!} alt="" className="size-full object-cover" />
                        ) : (
                          <Package className="size-4 text-gray-300" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-grafite-800">
                          {i.quantidade}× {e?.nome ?? "Equipamento removido"}
                        </span>
                        <span className="block truncate text-xs text-gray-500">
                          {m ? m.nome : "Sem modelo"}
                          {i.fornecimento === "existente" && " · existente no cliente"}
                        </span>
                      </span>
                      {pend.length > 0 ? (
                        <span className="flex items-center gap-1 text-xs text-amber-700" title={`${pend.length} pendência(s)`}>
                          <AlertTriangle className="size-3.5" /> {pend.length}
                        </span>
                      ) : (
                        <CircleCheck className="size-4 text-marca-600" aria-label="Sem pendências" />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {instancia && (
            <PainelDaInstancia
              key={instancia.id}
              instancia={instancia}
              equipamento={equipamentos.get(instancia.equipamentoId)}
              biblioteca={biblioteca}
              resultado={resultado.perguntas[instancia.id]}
              config={config}
              editavel={editavel}
              mudar={mudar}
              aoRemover={() => {
                mudar((c) => removerInstancia(c, instancia.id));
                setSelecionada(config.instancias.find((x) => x.id !== instancia.id)?.id ?? null);
              }}
              aoDuplicar={() => mudar((c) => duplicarInstancia(c, instancia.id, novoId))}
              aoClicarHotspot={(h) => clicarHotspot(h, instancia.equipamentoId)}
            />
          )}

          {cartaoDePendencias}
        </section>
      </div>
    </div>
  );
}

function IndicadorDeSalvamento({ estado, editavel }: { estado: EstadoDoSalvamento; editavel: boolean }) {
  if (!editavel) return <span className="text-sm text-gray-500">Somente leitura: o orçamento não está em rascunho.</span>;
  const hora = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <span role="status" aria-live="polite" className={cn("text-sm", estado.tipo === "erro" ? "text-red-700" : "text-gray-500")}>
      {estado.tipo === "salvo" && (estado.em ? `Rascunho salvo às ${hora(estado.em)}` : "Rascunho salvo")}
      {estado.tipo === "pendente" && "Alterações não salvas…"}
      {estado.tipo === "salvando" && "Salvando…"}
      {estado.tipo === "erro" && `Não foi possível salvar: ${estado.mensagem}`}
    </span>
  );
}

function Miniatura({ url, icone: Icone }: { url: string | null; icone: typeof Package }) {
  return (
    <div className="grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-contain" />
      ) : (
        <Icone className="size-6 text-gray-300" />
      )}
    </div>
  );
}

function CardDoEquipamento({
  e,
  quantidade,
  editavel,
  aoAdicionar,
}: {
  e: EquipamentoDoConfigurador;
  quantidade: number;
  editavel: boolean;
  aoAdicionar: () => void;
}) {
  return (
    <Card className={cn("flex flex-col gap-3 p-3", quantidade > 0 && "border-marca-500")} data-equipamento={e.nome}>
      <Miniatura url={e.imagemUrl} icone={ImageOff} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="font-medium text-grafite-900">{e.nome}</h3>
          {e.isDemo && <Badge tom="demo">DEMO</Badge>}
        </div>
        <p className="text-xs text-gray-500">
          {ROTULO_TIPO[e.tipo]} · {e.modelos.filter((m) => m.ativo).length} modelo(s)
        </p>
        {e.descricao && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{e.descricao}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{quantidade > 0 ? `${quantidade} no projeto` : ""}</span>
        <Button tamanho="sm" variante={quantidade > 0 ? "secundario" : "primario"} disabled={!editavel} onClick={aoAdicionar} aria-label={`Adicionar ${e.nome}`}>
          <Plus className="size-4" /> Adicionar
        </Button>
      </div>
    </Card>
  );
}

function CardDoKit({
  kit,
  equipamentos,
  editavel,
  aoAplicar,
}: {
  kit: KitDoConfigurador;
  equipamentos: Map<string, EquipamentoDoConfigurador>;
  editavel: boolean;
  aoAplicar: () => void;
}) {
  return (
    <Card className="flex flex-col gap-3 p-3">
      <Miniatura url={kit.imagemUrl} icone={Layers} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="font-medium text-grafite-900">{kit.nome}</h3>
          <Badge tom="marca">Kit</Badge>
          {kit.isDemo && <Badge tom="demo">DEMO</Badge>}
        </div>
        {kit.descricao && <p className="mt-1 line-clamp-2 text-xs text-gray-500">{kit.descricao}</p>}
        <ul className="mt-1.5 text-xs text-gray-600">
          {kit.itens.map((i, n) => (
            <li key={n}>
              {i.quantidade}× {equipamentos.get(i.equipamentoId)?.nome ?? "item indisponível"}
            </li>
          ))}
        </ul>
      </div>
      <Button tamanho="sm" disabled={!editavel || kit.itens.length === 0} onClick={aoAplicar} aria-label={`Aplicar ${kit.nome}`}>
        <Layers className="size-4" /> Aplicar kit
      </Button>
    </Card>
  );
}

function PainelDaInstancia({
  instancia: i,
  equipamento: e,
  biblioteca,
  resultado,
  config,
  editavel,
  mudar,
  aoRemover,
  aoDuplicar,
  aoClicarHotspot,
}: {
  instancia: ConfiguracaoDoProjeto["instancias"][number];
  equipamento: EquipamentoDoConfigurador | undefined;
  biblioteca: BibliotecaDoConfigurador;
  resultado: ReturnType<typeof calcular>["perguntas"][string] | undefined;
  config: ConfiguracaoDoProjeto;
  editavel: boolean;
  mudar: (f: (c: ConfiguracaoDoProjeto) => ConfiguracaoDoProjeto) => void;
  aoRemover: () => void;
  aoDuplicar: () => void;
  aoClicarHotspot: (h: HotspotDoConfigurador) => void;
}) {
  const imagens = biblioteca.imagens.filter((x) => x.equipamentoId === i.equipamentoId);
  const visiveis = resultado?.itens.filter((x) => x.visivel) ?? [];
  const modeloAtual = e?.modelos.find((m) => m.id === i.modeloId);
  const respostaAtual = (chave: string) => {
    const item = resultado?.itens.find((x) => x.pergunta.chave === chave);
    return i.respostas?.[chave] ?? item?.pergunta.padrao ?? null;
  };

  return (
    <Card className="flex flex-col gap-4 p-4" role="region" aria-label={`Configuração de ${e?.nome ?? "item"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-grafite-900">{e?.nome ?? "Equipamento removido"}</h2>
          {i.kitId && <p className="text-xs text-gray-500">Veio de um kit</p>}
        </div>
        {editavel && (
          <div className="flex items-center gap-1">
            <BotaoIcone titulo="Duplicar item" onClick={aoDuplicar}>
              <Copy className="size-4" />
            </BotaoIcone>
            <BotaoIcone titulo="Remover item" perigo onClick={aoRemover}>
              <Trash2 className="size-4" />
            </BotaoIcone>
          </div>
        )}
      </div>

      <fieldset disabled={!editavel} className="grid gap-3 @container sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-grafite-700">Modelo</span>
          <Select value={i.modeloId ?? ""} onChange={(ev) => mudar((c) => atualizarInstancia(c, i.id, { modeloId: ev.target.value || null }))}>
            <option value="">Escolha o modelo…</option>
            {e?.modelos
              .filter((m) => m.ativo || m.id === i.modeloId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                  {m.isDemo ? " (DEMO)" : ""}
                  {!m.ativo ? " (indisponível)" : ""}
                </option>
              ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-grafite-700">Quantidade</span>
          <Input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={Number.isFinite(i.quantidade) && i.quantidade > 0 ? i.quantidade : ""}
            onChange={(ev) => mudar((c) => atualizarInstancia(c, i.id, { quantidade: ev.target.value === "" ? 0 : Math.max(0, Math.floor(Number(ev.target.value))) }))}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-grafite-700">Fornecimento</span>
          <Select
            value={i.fornecimento}
            onChange={(ev) => mudar((c) => atualizarInstancia(c, i.id, { fornecimento: ev.target.value as "fornecido" | "existente" }))}
          >
            <option value="fornecido">Fornecido pela Zanatta</option>
            <option value="existente">Já existe no cliente</option>
          </Select>
        </label>
      </fieldset>

      {((config.ambientes?.length ?? 0) > 0 || (config.paineis?.length ?? 0) > 0) && (
        <fieldset disabled={!editavel} className="flex flex-col gap-3 rounded-lg bg-gray-50/70 p-3" aria-label="Onde fica">
          {(config.ambientes?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-grafite-700">Ambientes atendidos:</span>
              {config.ambientes!.map((a) => (
                <label key={a.id} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-4 accent-marca-600"
                    checked={i.ambientes?.includes(a.id) ?? false}
                    onChange={(ev) => {
                      const atuais = i.ambientes ?? [];
                      const novos = ev.target.checked ? [...atuais, a.id] : atuais.filter((x) => x !== a.id);
                      const setor = config.setores?.find((x) => x.id === i.setorId);
                      mudar((c) =>
                        atualizarInstancia(c, i.id, { ambientes: novos, setorId: setor && !novos.includes(setor.ambienteId) ? null : (i.setorId ?? null) }),
                      );
                    }}
                  />
                  {a.nome}
                </label>
              ))}
              {(i.ambientes?.length ?? 0) > 1 && <Badge tom="marca">Compartilhado</Badge>}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {(config.setores?.length ?? 0) > 0 && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-grafite-700">Setor</span>
                <Select value={i.setorId ?? ""} onChange={(ev) => mudar((c) => atualizarInstancia(c, i.id, { setorId: ev.target.value || null }))}>
                  <option value="">Sem setor</option>
                  {config.setores!
                    .filter((x) => i.ambientes?.includes(x.ambienteId) || x.id === i.setorId)
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {config.ambientes?.find((a) => a.id === x.ambienteId)?.nome} › {x.nome}
                      </option>
                    ))}
                </Select>
              </label>
            )}
            {(config.paineis?.length ?? 0) > 0 && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-grafite-700">Painel</span>
                <Select value={i.painelId ?? ""} onChange={(ev) => mudar((c) => atualizarInstancia(c, i.id, { painelId: ev.target.value || null }))}>
                  <option value="">Escolha o painel…</option>
                  {config.paineis!.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.identificacao}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
        </fieldset>
      )}

      {imagens.map((img) => (
        <ImagemComHotspots
          key={img.id}
          imagem={img}
          alturaMaxima={22}
          aoClicar={aoClicarHotspot}
          ativo={(h) => {
            if (h.alvoTipo === "MODELO") return h.alvoId === modeloAtual?.id;
            if (h.alvoTipo === "OPCAO") {
              const v = respostaAtual(h.alvoId);
              return Array.isArray(v) ? v.includes(h.alvoValor ?? "") : v === h.alvoValor;
            }
            return false;
          }}
        />
      ))}

      <div className="flex flex-col gap-4 border-t border-gray-100 pt-4" role="group" aria-label="Perguntas">
        {visiveis.length === 0 && <p className="text-sm text-gray-500">Nenhuma pergunta para este item.</p>}
        <fieldset disabled={!editavel} className="contents">
          {visiveis.map((item) => (
            <div key={item.pergunta.chave} data-pergunta={item.pergunta.chave}>
              <CampoDeResposta
                pergunta={item.pergunta}
                opcoes={item.opcoes}
                valor={respostaAtual(item.pergunta.chave)}
                valorAutomatico={item.valor}
                erro={item.erro}
                onChange={(v) => mudar((c) => responder(c, i.id, item.pergunta.chave, v))}
              />
            </div>
          ))}
        </fieldset>
      </div>
      {e && (
        <p className="text-xs text-gray-400">
          <Pencil className="mr-1 inline size-3" />
          As respostas ficam guardadas mesmo quando uma pergunta é ocultada; elas só contam enquanto a pergunta estiver visível.
        </p>
      )}
    </Card>
  );
}

