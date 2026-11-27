/**
 * PDF da proposta e do orçamento interno (@react-pdf/renderer, no servidor).
 * Valores formatados a partir dos mesmos textos decimais da tela e do Excel.
 */
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import { dinheiro, numero, pct } from "@/features/precos/formato";
import type { DocumentoDoOrcamento } from "./modelo";

const VERDE = "#1f7a3a";
const GRAFITE = "#2b2f33";
const GRUPO = { material: "Materiais", servico: "Serviços", software: "Software" } as const;

const s = StyleSheet.create({
  pagina: { padding: 36, paddingBottom: 48, fontSize: 9, fontFamily: "Helvetica", color: GRAFITE },
  topo: { flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 2, borderBottomColor: VERDE, paddingBottom: 8, marginBottom: 12 },
  marca: { fontSize: 14, fontFamily: "Helvetica-Bold", color: VERDE },
  titulo: { fontSize: 12, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  previa: { color: "#b45309", fontFamily: "Helvetica-Bold", fontSize: 9, marginBottom: 8 },
  secao: { fontSize: 11, fontFamily: "Helvetica-Bold", color: VERDE, marginTop: 12, marginBottom: 4 },
  paragrafo: { marginBottom: 4, lineHeight: 1.4 },
  dados: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  dado: { width: "50%", marginBottom: 2 },
  rotulo: { color: "#6b7280" },
  linha: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#e5e7eb", paddingVertical: 2 },
  cab: { flexDirection: "row", backgroundColor: "#f3f4f6", paddingVertical: 3, fontFamily: "Helvetica-Bold" },
  grupo: { fontFamily: "Helvetica-Bold", marginTop: 4, paddingVertical: 2 },
  total: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalGeral: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: GRAFITE, marginTop: 4, paddingTop: 4, fontSize: 11, fontFamily: "Helvetica-Bold" },
  rodape: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7, color: "#9ca3af" },
});

const col = (largura: string | number, direita = false) => ({ width: largura, textAlign: (direita ? "right" : "left") as "right" | "left", paddingHorizontal: 2 });

function TabelaDePrecos({ doc }: { doc: DocumentoDoOrcamento }) {
  const verCusto = !doc.precos.custosOcultos;
  return (
    <View>
      <View style={s.cab} fixed>
        <Text style={col("14%")}>Código</Text>
        <Text style={col(verCusto ? "34%" : "44%")}>Descrição</Text>
        <Text style={col("9%", true)}>Qtd.</Text>
        <Text style={col("6%")}>Un.</Text>
        <Text style={col("13%", true)}>Unitário</Text>
        <Text style={col("14%", true)}>Total</Text>
        {verCusto && <Text style={col("10%", true)}>Custo</Text>}
      </View>
      {(["material", "servico", "software"] as const).map((g) => {
        const linhas = doc.precos.linhas.filter((l) => l.grupo === g);
        if (!linhas.length) return null;
        return (
          <View key={g}>
            <Text style={s.grupo}>{GRUPO[g]}</Text>
            {linhas.map((l) => (
              <View key={l.chave} style={s.linha} wrap={false}>
                <Text style={col("14%")}>{l.codigo}</Text>
                <Text style={col(verCusto ? "34%" : "44%")}>{l.descricao}</Text>
                <Text style={col("9%", true)}>{numero(l.quantidade)}</Text>
                <Text style={col("6%")}>{l.unidade}</Text>
                <Text style={col("13%", true)}>{l.semPreco ? "sem preço" : dinheiro(l.unitario)}</Text>
                <Text style={col("14%", true)}>{dinheiro(l.total)}</Text>
                {verCusto && <Text style={col("10%", true)}>{dinheiro(l.custoTotal)}</Text>}
              </View>
            ))}
          </View>
        );
      })}
    </View>
  );
}

function Totais({ doc }: { doc: DocumentoDoOrcamento }) {
  const p = doc.precos;
  return (
    <View style={{ marginTop: 8, marginLeft: "45%" }} wrap={false}>
      {p.grupos.map((g) => (
        <View key={g.grupo}>
          <View style={s.total}>
            <Text>
              {GRUPO[g.grupo]}
              {g.parcial ? " (parcial)" : ""}
            </Text>
            <Text>{dinheiro(g.subtotal)}</Text>
          </View>
          {g.ajustes.map((a) => (
            <View key={a.id} style={s.total}>
              <Text style={s.rotulo}>
                {a.tipo === "desconto" ? "Desconto" : "Acréscimo"}
                {a.percentual ? ` ${pct(a.percentual)}` : ""}
              </Text>
              <Text>{dinheiro(a.valor)}</Text>
            </View>
          ))}
          {g.impostos.map((i) => (
            <View key={i.id} style={s.total}>
              <Text style={s.rotulo}>
                {i.nome} ({pct(i.percentual)})
              </Text>
              <Text>{dinheiro(i.valor)}</Text>
            </View>
          ))}
          {(g.ajustes.length > 0 || g.impostos.length > 0) && (
            <View style={s.total}>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>Total de {GRUPO[g.grupo].toLowerCase()}</Text>
              <Text style={{ fontFamily: "Helvetica-Bold" }}>{dinheiro(g.total)}</Text>
            </View>
          )}
        </View>
      ))}
      {p.ajustesGerais.map((a) => (
        <View key={a.id} style={s.total}>
          <Text style={s.rotulo}>
            {a.tipo === "desconto" ? "Desconto no total" : "Acréscimo no total"}
            {a.percentual ? ` ${pct(a.percentual)}` : ""}
          </Text>
          <Text>{dinheiro(a.valor)}</Text>
        </View>
      ))}
      <View style={s.totalGeral}>
        <Text>{p.parcial ? "Total geral (parcial)" : "Total geral"}</Text>
        <Text>{dinheiro(p.total)}</Text>
      </View>
      {!p.custosOcultos && (
        <Text style={[s.rotulo, { marginTop: 4 }]}>
          Custo total {dinheiro(p.custoTotal)} · margem sobre a venda líquida {pct(p.margem)}
        </Text>
      )}
    </View>
  );
}

function Lista({ titulo, colunas, linhas }: { titulo: string; colunas: { titulo: string; largura: string; direita?: boolean }[]; linhas: (string | number)[][] }) {
  return (
    <View>
      <Text style={s.secao}>{titulo}</Text>
      <View style={s.cab}>
        {colunas.map((c) => (
          <Text key={c.titulo} style={col(c.largura, c.direita)}>
            {c.titulo}
          </Text>
        ))}
      </View>
      {linhas.map((l, n) => (
        <View key={n} style={s.linha} wrap={false}>
          {l.map((v, i) => (
            <Text key={i} style={col(colunas[i]!.largura, colunas[i]!.direita)}>
              {typeof v === "number" ? numero(v) : v}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

function DocumentoPdf({ doc }: { doc: DocumentoDoOrcamento }) {
  const c = doc.cabecalho;
  const titulo = doc.tipo === "proposta" ? "Proposta comercial" : "Orçamento interno";
  return (
    <Document title={`${titulo} ${c.numero}`} author="Configurador de Automação" language="pt-BR">
      <Page size="A4" style={s.pagina}>
        <View style={s.topo} fixed>
          <Text style={s.marca}>Zanatta · Automação</Text>
          <Text>
            {titulo} {c.numero} · rev. {c.revisao}
          </Text>
        </View>
        {doc.previa && <Text style={s.previa}>PRÉVIA: orçamento ainda não emitido. Valores e textos podem mudar.</Text>}
        <Text style={s.titulo}>
          {c.cliente} · {c.projeto}
        </Text>
        <View style={s.dados}>
          {(
            [
              ["Empresa", c.empresa],
              ["Cidade", [c.cidade, c.uf].filter(Boolean).join("/") || null],
              ["Vendedor", c.vendedor],
              ["Data", c.data],
            ] as const
          ).map(([r, v]) =>
            v ? (
              <Text key={r} style={s.dado}>
                <Text style={s.rotulo}>{r}: </Text>
                {v}
              </Text>
            ) : null,
          )}
        </View>

        {doc.descritivo.length > 0 && (
          <View>
            <Text style={s.secao}>Descritivo técnico</Text>
            {doc.descritivo.map((sec, n) => (
              <View key={sec.id}>
                <Text style={{ fontFamily: "Helvetica-Bold", marginTop: 4, marginBottom: 2 }}>
                  {n + 1}. {sec.titulo}
                </Text>
                {sec.paragrafos.map((p) => (
                  <Text key={p.chave} style={s.paragrafo}>
                    {p.texto}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        )}

        <Text style={s.secao}>Investimento</Text>
        <TabelaDePrecos doc={doc} />
        <Totais doc={doc} />

        {doc.condicoes.length > 0 && (
          <View wrap={false}>
            <Text style={s.secao}>Condições comerciais</Text>
            {doc.condicoes.map((x) => (
              <Text key={x.rotulo} style={s.paragrafo}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>{x.rotulo}: </Text>
                {x.valor}
              </Text>
            ))}
          </View>
        )}

        {doc.tipo === "interno" && (
          <View break>
            <Lista
              titulo="Lista de materiais totalizada"
              colunas={[
                { titulo: "Código", largura: "18%" },
                { titulo: "Descrição", largura: "62%" },
                { titulo: "Un.", largura: "8%" },
                { titulo: "Qtd.", largura: "12%", direita: true },
              ]}
              linhas={doc.consolidado.map((l) => [l.codigo, l.descricao, l.unidade, l.quantidade])}
            />
            <Lista
              titulo="Lista de materiais detalhada"
              colunas={[
                { titulo: "Origem", largura: "36%" },
                { titulo: "Código", largura: "16%" },
                { titulo: "Descrição", largura: "32%" },
                { titulo: "Un.", largura: "6%" },
                { titulo: "Qtd.", largura: "10%", direita: true },
              ]}
              linhas={doc.detalhada.map((l) => [l.origem, l.codigo, l.descricao, l.unidade, l.quantidade])}
            />
            <Lista
              titulo="Lista preliminar de I/O"
              colunas={[
                { titulo: "Painel", largura: "50%" },
                { titulo: "Recurso", largura: "30%" },
                { titulo: "Quantidade", largura: "20%", direita: true },
              ]}
              linhas={doc.io.map((l) => [l.painel, l.recurso, l.quantidade])}
            />
            {doc.pendencias.length > 0 && (
              <Lista
                titulo="Pendências"
                colunas={[
                  { titulo: "Gravidade", largura: "16%" },
                  { titulo: "Mensagem", largura: "84%" },
                ]}
                linhas={doc.pendencias.map((p) => [p.gravidade, p.mensagem])}
              />
            )}
          </View>
        )}

        <View style={s.rodape} fixed>
          <Text>
            {titulo} {c.numero}
            {doc.previa ? " · PRÉVIA" : ""}
          </Text>
          <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export async function gerarPdf(doc: DocumentoDoOrcamento): Promise<Buffer> {
  return renderToBuffer(<DocumentoPdf doc={doc} />);
}
