/**
 * Layout da fatura da comercializadora fictícia (mercado livre) + relatório
 * mensal comparando o custo no livre com o custo estimado no cativo.
 */
import type { FaturaComercializadora } from "../tipos";
import {
  base,
  BlocoSemPagamento,
  Campo,
  Carimbo,
  COR,
  GraficoPares,
  MarcaDagua,
  Quadro,
  RodapeSimulacao,
  Tabela,
} from "./componentes";
import { data, mesAnoCurto, mesAnoLongo, moeda, num, pct, refMesAno } from "./formato";
import { Page, Text, View } from "./primitivas";

const MARCA = { primaria: "#1d6b52", destaque: "#7cc4a4", clara: "#e7f3ee", cativo: "#9aa3ad" };

function Logo() {
  return (
    <View style={[base.linha, { alignItems: "center" }]}>
      <View style={{ width: 30, height: 30, marginRight: 6, justifyContent: "center", gap: 3 }}>
        <View style={{ height: 3.2, width: 30, backgroundColor: MARCA.primaria, borderRadius: 2 }} />
        <View style={{ height: 3.2, width: 22, backgroundColor: MARCA.destaque, borderRadius: 2, marginLeft: 8 }} />
        <View style={{ height: 3.2, width: 26, backgroundColor: MARCA.primaria, borderRadius: 2, marginLeft: 2 }} />
      </View>
      <View>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 15, color: MARCA.primaria, letterSpacing: 0.4 }}>alísio</Text>
        <Text style={{ fontSize: 6, color: COR.suave, marginTop: 1 }}>Comercializadora de Energia · empresa fictícia</Text>
      </View>
    </View>
  );
}

function Cabecalho({ f, titulo }: { f: FaturaComercializadora; titulo: string }) {
  return (
    <View style={[base.linha, { justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }]}>
      <View style={{ flex: 1.3 }}>
        <Logo />
        <Text style={{ fontSize: 5.8, color: COR.suave, marginTop: 4 }}>
          {f.emissor.nome} · {f.emissor.documento} · {f.emissor.inscricaoEstadual}
        </Text>
        <Text style={{ fontSize: 5.8, color: COR.suave }}>{f.emissor.endereco}</Text>
        <Text style={{ fontSize: 5.8, color: COR.suave }}>{f.emissor.atendimento}</Text>
      </View>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.2, color: MARCA.primaria, textAlign: "right" }}>{titulo}</Text>
        <Text style={{ fontSize: 6.2, color: COR.suave, textAlign: "right", marginTop: 1, marginBottom: 4 }}>
          Nº {f.numero} · Emissão: {data(f.emissao)}
        </Text>
        <Carimbo />
      </View>
    </View>
  );
}

export function PaginasFaturaComercializadora({ fatura: f }: { fatura: FaturaComercializadora }) {
  const e = f.energia;
  const c = f.comparativo;
  const historico = f.historicoComparativo.length ? f.historicoComparativo : [c];
  const economia12 = historico.reduce((s, h) => s + h.economia, 0);
  const cativo12 = historico.reduce((s, h) => s + h.cativoEquivalente, 0);

  return (
    <>
      <Page size="A4" style={base.pagina}>
        <Cabecalho f={f} titulo="FATURA DE ENERGIA ELÉTRICA — MERCADO LIVRE" />
        <View style={[base.linha, { gap: 4, marginBottom: 4 }]}>
          <Campo rotulo="Competência" valor={refMesAno(f.competencia)} destaque cor={MARCA.primaria} alinhar="center" />
          <Campo rotulo="Total a pagar (R$)" valor={num(f.total, 2)} destaque cor={MARCA.primaria} alinhar="center" />
          <Campo rotulo="Vencimento" valor={data(f.vencimento)} destaque cor={MARCA.primaria} alinhar="center" />
        </View>

        <View style={[base.linha, { gap: 4, marginBottom: 4 }]}>
          <Quadro titulo="Cliente" cor={MARCA.primaria} style={{ flex: 1.2 }}>
            <View style={{ padding: 5 }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{f.cliente.nome}</Text>
              {f.cliente.endereco.map((l) => (
                <Text key={l} style={{ fontSize: 6.6 }}>
                  {l}
                </Text>
              ))}
              <Text style={{ fontSize: 6.6 }}>{f.cliente.documento}</Text>
            </View>
          </Quadro>
          <Quadro titulo="Contrato e medição" cor={MARCA.primaria} style={{ flex: 1 }}>
            <View style={{ padding: 5, gap: 1 }}>
              <Text style={{ fontSize: 6.5 }}>{f.contrato}</Text>
              <Text style={{ fontSize: 6.5 }}>
                <Text style={base.negrito}>Ponto de medição: </Text>
                {f.pontoMedicao}
              </Text>
              <Text style={{ fontSize: 6.5 }}>
                <Text style={base.negrito}>UC na distribuidora: </Text>
                {f.uc.numeroUc} (A4 · verde)
              </Text>
              <Text style={{ fontSize: 6.5 }}>
                <Text style={base.negrito}>Submercado: </Text>Nordeste
              </Text>
              <Text style={{ fontSize: 6.5 }}>
                <Text style={base.negrito}>Período de medição: </Text>
                {data(f.leituraAnterior)} a {data(f.leituraAtual)} ({f.dias} dias)
              </Text>
            </View>
          </Quadro>
        </View>

        <Quadro titulo="Demonstrativo da energia" cor={MARCA.primaria} style={{ marginBottom: 4 }}>
          <Tabela
            colunas={[
              { titulo: "Descrição", flex: 2.6 },
              { titulo: "%", flex: 0.6 },
              { titulo: "MWh", flex: 1 },
            ]}
            linhas={[
              ["Energia medida pela distribuidora (ponta + fora ponta)", "", num(e.medidoMwh, 3)],
              ["(+) Perdas da rede básica", pct(e.perdasPercentual, 1), num(e.perdasMwh, 3)],
              ["(-) Cota do PROINFA", pct(e.proinfaPercentual, 1), `-${num(e.proinfaMwh, 3)}`],
            ]}
            rodape={["Quantidade faturada", "", num(e.faturadoMwh, 3)]}
            tamanho={6.8}
          />
        </Quadro>

        <Quadro titulo="Itens da fatura" cor={MARCA.primaria} style={{ marginBottom: 4 }}>
          <Tabela
            colunas={[
              { titulo: "Item", flex: 2.2 },
              { titulo: "Quant. (MWh)", flex: 1 },
              { titulo: "Preço s/ ICMS (R$/MWh)", flex: 1.2 },
              { titulo: "Valor s/ ICMS (R$)", flex: 1.1 },
              { titulo: "Alíq. ICMS (%)", flex: 0.8 },
              { titulo: "ICMS (R$)", flex: 1 },
              { titulo: "Preço c/ ICMS (R$/MWh)", flex: 1.2 },
              { titulo: "Valor (R$)", flex: 1.1 },
            ]}
            linhas={[
              [
                "Energia elétrica — mercado livre",
                num(e.faturadoMwh, 3),
                num(e.precoMwhSemIcms, 2),
                num(e.valorSemIcms, 2),
                pct(e.aliquotaIcms),
                num(e.icms, 2),
                num(e.precoMwhComIcms, 2),
                num(f.total, 2),
              ],
            ]}
            rodape={["TOTAL", "", "", num(e.valorSemIcms, 2), "", num(e.icms, 2), "", num(f.total, 2)]}
            tamanho={6.8}
          />
        </Quadro>

        <View style={[base.linha, { gap: 4 }]}>
          <Quadro titulo="Tributos" cor={MARCA.primaria} style={{ flex: 1 }}>
            <Tabela
              colunas={[
                { titulo: "Tributo", flex: 1 },
                { titulo: "Base (R$)", flex: 1.2 },
                { titulo: "Alíquota (%)", flex: 1 },
                { titulo: "Valor (R$)", flex: 1.1 },
              ]}
              linhas={[
                ...f.tributos.map((t) => [t.tributo, num(t.base, 2), pct(t.aliquota), num(t.valor, 2)]),
                ["PIS/COFINS", "inclusos no preço", "", ""],
              ]}
              tamanho={6.5}
            />
          </Quadro>
          <Quadro titulo="Resumo do mês (detalhes na página 2)" cor={MARCA.primaria} style={{ flex: 1 }}>
            <View style={{ padding: 5, gap: 1.5 }}>
              <Text style={{ fontSize: 6.6 }}>
                Custo no mercado livre (distribuição + energia): <Text style={base.negrito}>{moeda(c.totalLivre)}</Text>
              </Text>
              <Text style={{ fontSize: 6.6 }}>
                Custo estimado no mercado cativo: <Text style={base.negrito}>{moeda(c.cativoEquivalente)}</Text>
              </Text>
              <Text style={{ fontSize: 7.4, color: MARCA.primaria, fontFamily: "Helvetica-Bold", marginTop: 1 }}>
                Economia estimada: {moeda(c.economia)} ({pct(c.economiaPercentual, 1)}%)
              </Text>
            </View>
          </Quadro>
        </View>

        <Quadro titulo="Informações" cor={MARCA.primaria} style={{ marginTop: 4 }}>
          <View style={{ padding: 5, gap: 1.5 }}>
            {f.mensagens.map((m) => (
              <Text key={m} style={{ fontSize: 6.4 }}>
                • {m}
              </Text>
            ))}
          </View>
        </Quadro>
        <BlocoSemPagamento vencimento={data(f.vencimento)} total={moeda(f.total)} />
        <MarcaDagua />
        <RodapeSimulacao emissor={f.emissor.nome} />
      </Page>

      <Page size="A4" style={base.pagina}>
        <Cabecalho f={f} titulo="RELATÓRIO MENSAL — MERCADO LIVRE × CATIVO" />
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, marginBottom: 2 }}>
          {f.cliente.nome} · {mesAnoLongo(f.competencia)}
        </Text>
        <Text style={{ fontSize: 6.8, color: COR.suave, marginBottom: 6 }}>
          Quanto a unidade pagou no mercado livre (fatura da distribuidora + fatura de energia) comparado com o que pagaria
          comprando a energia da distribuidora (mercado cativo), para as mesmas medições.
        </Text>

        <View style={[base.linha, { gap: 4, marginBottom: 6 }]}>
          <Campo rotulo="Distribuição (TUSD)" valor={moeda(c.distribuicao)} />
          <Campo rotulo="Energia (esta fatura)" valor={moeda(c.energia)} />
          <Campo rotulo="Total no mercado livre" valor={moeda(c.totalLivre)} />
          <Campo rotulo="Estimativa no cativo" valor={moeda(c.cativoEquivalente)} />
          <Campo
            rotulo="Economia no mês"
            valor={`${moeda(c.economia)} (${pct(c.economiaPercentual, 1)}%)`}
            destaque
            cor={MARCA.primaria}
            flex={1.35}
            tamanho={9.5}
          />
        </View>

        <Quadro titulo="Custo mensal — livre × cativo estimado (R$)" cor={MARCA.primaria} style={{ marginBottom: 6 }}>
          <View style={{ padding: 8 }}>
            <View style={[base.linha, { gap: 10, marginBottom: 6 }]}>
              <View style={[base.linha, { alignItems: "center", gap: 3 }]}>
                <View style={{ width: 8, height: 8, backgroundColor: MARCA.primaria }} />
                <Text style={{ fontSize: 6.4 }}>Mercado livre (distribuição + energia)</Text>
              </View>
              <View style={[base.linha, { alignItems: "center", gap: 3 }]}>
                <View style={{ width: 8, height: 8, backgroundColor: MARCA.cativo }} />
                <Text style={{ fontSize: 6.4 }}>Estimativa no mercado cativo</Text>
              </View>
            </View>
            <GraficoPares
              pares={historico.map((h) => [h.totalLivre, h.cativoEquivalente])}
              rotulos={historico.map((h) => mesAnoCurto(h.competencia))}
              cores={[MARCA.primaria, MARCA.cativo]}
              altura={150}
            />
          </View>
        </Quadro>

        <Quadro titulo="Histórico" cor={MARCA.primaria} style={{ marginBottom: 6 }}>
          <Tabela
            colunas={[
              { titulo: "Competência", flex: 1 },
              { titulo: "Distribuição (R$)", flex: 1.1 },
              { titulo: "Energia (R$)", flex: 1.1 },
              { titulo: "Total livre (R$)", flex: 1.1 },
              { titulo: "Cativo estimado (R$)", flex: 1.2 },
              { titulo: "Economia (R$)", flex: 1.1 },
              { titulo: "Economia (%)", flex: 0.9 },
            ]}
            linhas={historico.map((h) => [
              refMesAno(h.competencia),
              num(h.distribuicao, 2),
              num(h.energia, 2),
              num(h.totalLivre, 2),
              num(h.cativoEquivalente, 2),
              num(h.economia, 2),
              pct(h.economiaPercentual, 1),
            ])}
            rodape={[
              `${historico.length} meses`,
              num(historico.reduce((s, h) => s + h.distribuicao, 0), 2),
              num(historico.reduce((s, h) => s + h.energia, 0), 2),
              num(historico.reduce((s, h) => s + h.totalLivre, 0), 2),
              num(cativo12, 2),
              num(economia12, 2),
              pct(cativo12 > 0 ? (economia12 / cativo12) * 100 : 0, 1),
            ]}
            destacarUltima
            tamanho={6.6}
          />
        </Quadro>

        <Quadro titulo="Premissas da estimativa" cor={MARCA.primaria}>
          <View style={{ padding: 5, gap: 1.5 }}>
            {[
              "Cativo estimado com as tarifas A4 verde da distribuidora fictícia (demanda, consumo na ponta e fora da ponta com TUSD + TE), bandeiras tarifárias do período, reativo excedente e iluminação pública.",
              "Mercado livre = fatura de uso do sistema da distribuidora + esta fatura de energia (com perdas, PROINFA e ICMS).",
              "No mercado livre não há bandeira tarifária: em meses de bandeira amarela ou vermelha a economia tende a ser maior.",
              "Valores fictícios gerados para simulação; não use como base para decisões reais.",
            ].map((m) => (
              <Text key={m} style={{ fontSize: 6.4 }}>
                • {m}
              </Text>
            ))}
          </View>
        </Quadro>
        <MarcaDagua />
        <RodapeSimulacao emissor={f.emissor.nome} />
      </Page>
    </>
  );
}
