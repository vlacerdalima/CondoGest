/**
 * Layout da fatura da distribuidora fictícia (B3 cativo, A4 verde cativo e
 * A4 verde livre — só uso do sistema).
 */
import { ROTULO_BANDEIRA } from "../tarifas";
import type { FaturaDistribuidora, ItemDetalhado } from "../tipos";
import {
  base,
  BlocoSemPagamento,
  Campo,
  Carimbo,
  COR,
  GraficoColunas,
  MarcaDagua,
  Quadro,
  RodapeSimulacao,
  Tabela,
  type Coluna,
} from "./componentes";
import { data, mesAnoCurto, moeda, num, pct, refMesAno } from "./formato";
import { Page, Text, View } from "./primitivas";

const MARCA = { primaria: "#0f4c81", destaque: "#e39b00", clara: "#e8f0f8" };

const casasDaUnidade = (u: ItemDetalhado["unidade"]) => (u === "kW" || u === "kVAr" ? 2 : u === "MWh" ? 3 : 0);

function Logo() {
  return (
    <View style={[base.linha, { alignItems: "center" }]}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: MARCA.primaria,
          alignItems: "center",
          justifyContent: "center",
          marginRight: 6,
        }}
      >
        <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: MARCA.destaque, position: "absolute", top: 4, right: 4 }} />
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, color: "#ffffff" }}>EL</Text>
      </View>
      <View>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 15, color: MARCA.primaria, letterSpacing: -0.3 }}>
          Ener<Text style={{ color: MARCA.destaque }}>Litoral</Text>
        </Text>
        <Text style={{ fontSize: 6, color: COR.suave, marginTop: 1 }}>Distribuidora S.A. · empresa fictícia</Text>
      </View>
    </View>
  );
}

function Cabecalho({ f }: { f: FaturaDistribuidora }) {
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
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.2, color: MARCA.primaria, textAlign: "right" }}>
          FATURA DE ENERGIA ELÉTRICA
        </Text>
        <Text style={{ fontSize: 6.2, color: COR.suave, textAlign: "right", marginTop: 1 }}>
          Nº {f.numero} · Série SIM · Emissão: {data(f.emissao)}
        </Text>
        <Text style={{ fontSize: 6.2, color: COR.suave, textAlign: "right", marginBottom: 4 }}>
          Chave de acesso: SIMULAÇÃO (não há documento fiscal)
        </Text>
        <Carimbo />
      </View>
    </View>
  );
}

function Destaques({ f }: { f: FaturaDistribuidora }) {
  return (
    <View style={[base.linha, { gap: 4, marginBottom: 4 }]}>
      <Campo rotulo="REF: MÊS/ANO" valor={refMesAno(f.competencia)} destaque cor={MARCA.primaria} alinhar="center" />
      <Campo rotulo="TOTAL A PAGAR (R$)" valor={num(f.total, 2)} destaque cor={MARCA.primaria} alinhar="center" />
      <Campo rotulo="VENCIMENTO" valor={data(f.vencimento)} destaque cor={MARCA.primaria} alinhar="center" />
    </View>
  );
}

function Cliente({ f }: { f: FaturaDistribuidora }) {
  const a4 = f.uc.subgrupo === "A4";
  return (
    <View style={[base.linha, { gap: 4, marginBottom: 4 }]}>
      <Quadro titulo="Dados do cliente" cor={MARCA.primaria} style={{ flex: 1.45 }}>
        <View style={{ padding: 5 }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{f.cliente.nome}</Text>
          {f.cliente.endereco.map((l) => (
            <Text key={l} style={{ fontSize: 6.6 }}>
              {l}
            </Text>
          ))}
          <Text style={{ fontSize: 6.6 }}>{f.cliente.documento}</Text>
          <Text style={{ fontSize: 6.6, marginTop: 3 }}>
            <Text style={base.negrito}>Classificação: </Text>
            {f.classificacao}
          </Text>
          <Text style={{ fontSize: 6.6 }}>
            <Text style={base.negrito}>Tipo de fornecimento: </Text>
            {f.tipoFornecimento}
            {a4 ? " · Tensão de fornecimento: 13,8 kV" : " · Tensão nominal: 220/380 V"}
          </Text>
        </View>
      </Quadro>
      <View style={{ flex: 1, gap: 4 }}>
        <Campo rotulo="Nº da unidade consumidora (UC)" valor={f.uc.numeroUc} />
        <View style={[base.linha, { gap: 4 }]}>
          <Campo rotulo="Nº do medidor" valor={f.uc.numeroMedidor} />
          <Campo rotulo="Roteiro de leitura" valor={`SIM-${f.uc.numeroMedidor.slice(-3)}`} />
        </View>
        {a4 ? (
          <Campo
            rotulo="Grandezas contratadas"
            valor={`Montante de Uso Contratado (kW): ${num(f.uc.demandaContratadaKw ?? 0)}`}
          />
        ) : (
          <Campo rotulo="Bandeira tarifária em vigor" valor={ROTULO_BANDEIRA[f.bandeira].toUpperCase()} />
        )}
      </View>
    </View>
  );
}

function Leituras({ f }: { f: FaturaDistribuidora }) {
  return (
    <Quadro titulo="Datas de leituras" cor={MARCA.primaria} style={{ marginBottom: 4 }}>
      <View style={[base.linha, { padding: 3, gap: 3 }]}>
        <Campo rotulo="Leitura anterior" valor={data(f.leituraAnterior)} alinhar="center" />
        <Campo rotulo="Leitura atual" valor={data(f.leituraAtual)} alinhar="center" />
        <Campo rotulo="Nº de dias" valor={String(f.dias)} alinhar="center" />
        <Campo rotulo="Próxima leitura (prevista)" valor={data(f.proximaLeitura)} alinhar="center" />
      </View>
    </Quadro>
  );
}

const COLUNAS_ITENS: Coluna[] = [
  { titulo: "Itens da fatura", flex: 2.4 },
  { titulo: "Unid.", flex: 0.6, alinhar: "center" },
  { titulo: "Quant.", flex: 0.95 },
  { titulo: "Preço unit. (R$) c/ tributos", flex: 1.2 },
  { titulo: "Valor (R$)", flex: 1 },
  { titulo: "PIS/COFINS (R$)", flex: 0.95 },
  { titulo: "Base calc. ICMS (R$)", flex: 1 },
  { titulo: "Alíq. ICMS (%)", flex: 0.7 },
  { titulo: "ICMS (R$)", flex: 0.85 },
  { titulo: "Tarifa unit. (R$) s/ tributos", flex: 1.2 },
];

function Itens({ f }: { f: FaturaDistribuidora }) {
  const vazio = "";
  const linhas = f.itens.map((i) => [
    i.descricao,
    i.unidade ?? vazio,
    i.quantidade !== undefined ? num(i.quantidade, casasDaUnidade(i.unidade)) : vazio,
    i.precoUnitario !== undefined ? num(i.precoUnitario, 6) : vazio,
    num(i.valor, 2),
    i.pisCofins !== undefined ? num(i.pisCofins, 2) : vazio,
    i.baseIcms !== undefined ? num(i.baseIcms, 2) : vazio,
    i.aliquotaIcms !== undefined ? pct(i.aliquotaIcms) : vazio,
    i.icms !== undefined ? num(i.icms, 2) : vazio,
    i.tarifaSemTributos !== undefined ? num(i.tarifaSemTributos, 6) : vazio,
  ]);
  const soma = (k: "pisCofins" | "baseIcms" | "icms") => f.itens.reduce((s, i) => s + (i[k] ?? 0), 0);
  return (
    <Quadro titulo="Itens da fatura" cor={MARCA.primaria} style={{ marginBottom: 4 }}>
      <Tabela
        colunas={COLUNAS_ITENS}
        linhas={linhas}
        rodape={["TOTAL", "", "", "", num(f.total, 2), num(soma("pisCofins"), 2), num(soma("baseIcms"), 2), "", num(soma("icms"), 2), ""]}
        tamanho={6.5}
      />
    </Quadro>
  );
}

function Tributos({ f }: { f: FaturaDistribuidora }) {
  return (
    <Quadro titulo="Tributos" cor={MARCA.primaria}>
      <Tabela
        colunas={[
          { titulo: "Tributo", flex: 1 },
          { titulo: "Base de cálculo (R$)", flex: 1.3 },
          { titulo: "Alíquota (%)", flex: 1 },
          { titulo: "Valor (R$)", flex: 1.1 },
        ]}
        linhas={f.tributos.map((t) => [t.tributo, num(t.base, 2), pct(t.aliquota), num(t.valor, 2)])}
        tamanho={6.5}
      />
    </Quadro>
  );
}

function Medidor({ f }: { f: FaturaDistribuidora }) {
  return (
    <Quadro titulo="Medidor" cor={MARCA.primaria}>
      <Tabela
        colunas={[
          { titulo: "Medidor", flex: 0.95 },
          { titulo: "Grandezas", flex: 1.45 },
          { titulo: "Posto horário", flex: 0.9 },
          { titulo: "Leitura anterior", flex: 0.95 },
          { titulo: "Leitura atual", flex: 0.95 },
          { titulo: "Const. medidor", flex: 0.65 },
          { titulo: "Consumo", flex: 1.15 },
        ]}
        linhas={f.medidor.map((m) => {
          const demanda = m.unidade === "kW";
          return [
            f.uc.numeroMedidor,
            m.grandeza,
            m.posto,
            m.leituraAnterior !== undefined ? num(m.leituraAnterior) : "-",
            demanda ? num(m.leituraAtual, 2) : num(m.leituraAtual),
            num(m.constante, 1),
            `${num(m.medido, demanda ? 2 : 0)} ${m.unidade}`,
          ];
        })}
        tamanho={6}
      />
    </Quadro>
  );
}

/** Indicadores de continuidade (valores fictícios, estáveis por fatura) */
function Indicadores({ f }: { f: FaturaDistribuidora }) {
  const houveCompensacao = f.itens.some((i) => i.descricao.startsWith("Comp. DIC"));
  let h = 0;
  for (const ch of f.numero) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const dic = houveCompensacao ? 8.1 + (h % 40) / 10 : (h % 90) / 100;
  const fic = houveCompensacao ? 5 + (h % 3) : h % 2;
  const a4 = f.uc.subgrupo === "A4";
  const limites = a4 ? { dic: 4.21, fic: 2.88, dmic: 2.34, dicri: 9.84 } : { dic: 7.46, fic: 4.63, dmic: 3.92, dicri: 14.15 };
  return (
    <Quadro titulo="Indicadores de continuidade (fictícios)" cor={MARCA.primaria}>
      <Tabela
        colunas={[
          { titulo: "Indicador", flex: 2.2 },
          { titulo: "Apurado no mês", flex: 1 },
          { titulo: "Limite mensal", flex: 1 },
        ]}
        linhas={[
          ["DIC — duração de interrupção (horas)", num(dic, 2), num(limites.dic, 2)],
          ["FIC — frequência de interrupção (vezes)", num(fic, 0), num(limites.fic, 2)],
          ["DMIC — maior interrupção (horas)", num(houveCompensacao ? dic * 0.6 : dic, 2), num(limites.dmic, 2)],
          ["DICRI — dia crítico (horas)", num(0, 2), num(limites.dicri, 2)],
        ]}
        tamanho={6}
      />
      <Text style={{ fontSize: 5.6, color: COR.suave, paddingHorizontal: 4, paddingVertical: 2 }}>
        Conjunto elétrico SIM-{f.uc.numeroMedidor.slice(-2)} (fictício). Ultrapassado o limite, há compensação na fatura.
      </Text>
    </Quadro>
  );
}

/** B3: tabela de 13 meses com barras horizontais (quadro "CONSUMO / kWh") */
function HistoricoB3({ f }: { f: FaturaDistribuidora }) {
  const max = Math.max(1, ...f.historico.map((h) => h.consumoKwh));
  const media =
    f.historico.slice(0, -1).reduce((s, h) => s + h.consumoKwh, 0) / Math.max(1, f.historico.length - 1);
  return (
    <Quadro titulo="Consumo / kWh — últimos 13 meses" cor={MARCA.primaria}>
      <View style={{ paddingHorizontal: 4, paddingTop: 3, paddingBottom: 4 }}>
        <View style={[base.linha, { borderBottomWidth: 0.6, borderBottomColor: COR.borda, paddingBottom: 1.5 }]}>
          <Text style={[base.rotulo, { width: 34 }]}>Mês/ano</Text>
          <Text style={[base.rotulo, { width: 38, textAlign: "right" }]}>Consumo</Text>
          <Text style={[base.rotulo, { width: 22, textAlign: "right" }]}>Dias</Text>
          <Text style={[base.rotulo, { flex: 1, paddingLeft: 6 }]}>kWh faturado</Text>
        </View>
        {[...f.historico].reverse().map((h, i) => (
          <View key={h.competencia} style={[base.linha, { alignItems: "center", paddingVertical: 1.15 }]}>
            <Text style={{ width: 34, fontSize: 6.2, fontFamily: i === 0 ? "Helvetica-Bold" : "Helvetica" }}>
              {mesAnoCurto(h.competencia)}
            </Text>
            <Text style={{ width: 38, fontSize: 6.2, textAlign: "right", fontFamily: i === 0 ? "Helvetica-Bold" : "Helvetica" }}>
              {num(h.consumoKwh)}
            </Text>
            <Text style={{ width: 22, fontSize: 6.2, textAlign: "right" }}>{h.dias}</Text>
            <View style={{ flex: 1, paddingLeft: 6 }}>
              <View
                style={{
                  height: 5,
                  width: `${Math.max(1, (h.consumoKwh / max) * 100)}%`,
                  backgroundColor: i === 0 ? MARCA.destaque : MARCA.primaria,
                  opacity: i === 0 ? 1 : 0.75,
                }}
              />
            </View>
          </View>
        ))}
        <Text style={{ fontSize: 5.8, color: COR.suave, marginTop: 2 }}>
          Média dos 12 meses anteriores: {num(media)} kWh · Este mês: {num(f.consumoKwh / Math.max(1, f.dias), 1)} kWh/dia
        </Text>
      </View>
    </Quadro>
  );
}

/** A4: três gráficos de 13 meses (encargo ponta, fora ponta e demanda medida) */
function HistoricoA4({ f }: { f: FaturaDistribuidora }) {
  const livre = f.tipo === "a4_verde_livre_distribuicao";
  const rotulos = f.historico.map((h) => mesAnoCurto(h.competencia));
  const series = [
    {
      titulo: livre ? "Uso encargo faturado — ponta (kWh)" : "Consumo faturado — ponta (kWh)",
      valores: f.historico.map((h) => h.consumoPontaKwh ?? 0),
      unidade: "kWh",
      casas: 0,
    },
    {
      titulo: livre ? "Uso encargo faturado — fora ponta (kWh)" : "Consumo faturado — fora ponta (kWh)",
      valores: f.historico.map((h) => h.consumoForaPontaKwh ?? 0),
      unidade: "kWh",
      casas: 0,
    },
    {
      titulo: livre ? "Uso fio medido (kW)" : "Demanda medida (kW)",
      valores: f.historico.map((h) => h.demandaMedidaKw ?? 0),
      unidade: "kW",
      casas: 1,
    },
  ];
  return (
    <Quadro titulo="Histórico — últimos 13 meses" cor={MARCA.primaria}>
      <View style={{ padding: 4, gap: 5 }}>
        {series.map((s) => {
          const anteriores = s.valores.slice(0, -1);
          const media = anteriores.reduce((a, b) => a + b, 0) / Math.max(1, anteriores.length);
          return (
            <View key={s.titulo}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 6.2, marginBottom: 2 }}>{s.titulo}</Text>
              <GraficoColunas valores={s.valores} rotulos={rotulos} cor={MARCA.primaria} corDestaque={MARCA.destaque} altura={38} />
              <Text style={{ fontSize: 5.6, color: COR.suave, marginTop: 1 }}>
                Este mês: {num(s.valores[s.valores.length - 1], s.casas)} {s.unidade} · média 12 meses: {num(media, s.casas)}{" "}
                {s.unidade} · máximo: {num(Math.max(...s.valores), s.casas)} {s.unidade}
              </Text>
            </View>
          );
        })}
        {f.uc.demandaContratadaKw !== undefined && (
          <Text style={{ fontSize: 5.8, color: COR.suave }}>
            Demanda contratada: {num(f.uc.demandaContratadaKw)} kW · fator de potência médio no ciclo:{" "}
            {num(f.fatorPotencia ?? 0, 2)}
          </Text>
        )}
      </View>
    </Quadro>
  );
}

function Mensagens({ f }: { f: FaturaDistribuidora }) {
  return (
    <Quadro titulo="Informações importantes" cor={MARCA.primaria} style={{ marginTop: 4 }}>
      <View style={{ padding: 5, gap: 1.5 }}>
        {f.mensagens.map((m) => (
          <Text key={m} style={{ fontSize: 6.4 }}>
            • {m}
          </Text>
        ))}
      </View>
    </Quadro>
  );
}

export function PaginaFaturaDistribuidora({ fatura: f }: { fatura: FaturaDistribuidora }) {
  const a4 = f.uc.subgrupo === "A4";
  return (
    <Page size="A4" style={base.pagina}>
      <Cabecalho f={f} />
      <Destaques f={f} />
      <Cliente f={f} />
      <Leituras f={f} />
      <Itens f={f} />
      <View style={[base.linha, { gap: 4 }]}>
        <View style={{ flex: a4 ? 1.08 : 1.05, gap: 4 }}>
          <Tributos f={f} />
          <Medidor f={f} />
          <Indicadores f={f} />
        </View>
        <View style={{ flex: 1 }}>{a4 ? <HistoricoA4 f={f} /> : <HistoricoB3 f={f} />}</View>
      </View>
      <Mensagens f={f} />
      <BlocoSemPagamento vencimento={data(f.vencimento)} total={moeda(f.total)} />
      <MarcaDagua />
      <RodapeSimulacao emissor={f.emissor.nome} />
    </Page>
  );
}
