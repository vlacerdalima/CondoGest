/**
 * Peças comuns dos PDFs fictícios: marca d'água, rodapé de simulação,
 * caixas, tabelas com bordas finas e gráficos de barras (só com View).
 */
import type { ReactNode } from "react";
import { criarEstilos, Text, View, type Estilo } from "./primitivas";

export const COR = {
  texto: "#1b2430",
  suave: "#5b6573",
  borda: "#9aa3ad",
  bordaClara: "#c9cfd6",
  fundo: "#eef1f4",
  simulacao: "#c42f2f",
};

export const TEXTO_SIMULACAO = "DOCUMENTO FICTÍCIO — SIMULAÇÃO CONDOGEST — SEM VALOR";

export const base = criarEstilos({
  pagina: {
    paddingTop: 22,
    paddingBottom: 46,
    paddingHorizontal: 24,
    fontFamily: "Helvetica",
    fontSize: 7,
    color: COR.texto,
  },
  negrito: { fontFamily: "Helvetica-Bold" },
  linha: { flexDirection: "row" },
  rotulo: { fontSize: 5.6, color: COR.suave, textTransform: "uppercase", letterSpacing: 0.2 },
  tituloQuadro: {
    fontFamily: "Helvetica-Bold",
    fontSize: 6.6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    paddingHorizontal: 4,
    paddingVertical: 2.2,
    color: "#ffffff",
  },
});

/* ------------------------------ marca d'água e rodapé ------------------------------ */

/**
 * Marca d'água diagonal (fixa em todas as páginas, desenhada por cima do
 * conteúdo com transparência): uma linha grande na diagonal da folha A4 e
 * duas paralelas, cada uma deslocada para caber inteira na página.
 */
export function MarcaDagua() {
  const linha = {
    fontFamily: "Helvetica-Bold",
    color: COR.simulacao,
    textAlign: "center" as const,
    letterSpacing: 1,
  };
  return (
    <View
      fixed
      style={{
        position: "absolute",
        left: (595.28 - 1100) / 2,
        top: (841.89 - 420) / 2,
        width: 1100,
        height: 420,
        justifyContent: "center",
        transform: "rotate(-54.7deg)",
        opacity: 0.2,
      }}
    >
      <Text style={{ ...linha, fontSize: 17, paddingLeft: 130, marginBottom: 156 }}>{TEXTO_SIMULACAO}</Text>
      <Text style={{ ...linha, fontSize: 26 }}>{TEXTO_SIMULACAO}</Text>
      <Text style={{ ...linha, fontSize: 17, paddingRight: 130, marginTop: 156 }}>{TEXTO_SIMULACAO}</Text>
    </View>
  );
}

export function RodapeSimulacao({ emissor }: { emissor: string }) {
  return (
    <View
      fixed
      style={{
        position: "absolute",
        left: 24,
        right: 24,
        bottom: 14,
        borderTopWidth: 1,
        borderTopColor: COR.simulacao,
        paddingTop: 4,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
      }}
    >
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 7, color: COR.simulacao }}>{TEXTO_SIMULACAO}</Text>
        <Text style={{ fontSize: 5.8, color: COR.suave, marginTop: 1 }}>
          Gerado pelo simulador do CondoGest para testes. Não é cobrança, não tem valor fiscal e não deve ser pago.
          {` Emissor fictício: ${emissor.replace(/\.$/, "")}. Nenhum dado pertence a pessoa ou empresa real.`}
        </Text>
      </View>
      <Text
        style={{ fontSize: 6, color: COR.suave }}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

/* ------------------------------ caixas ------------------------------ */

export function Quadro({
  titulo,
  cor,
  children,
  style,
}: {
  titulo?: string;
  cor: string;
  children: ReactNode;
  style?: Estilo;
}) {
  return (
    <View style={[{ borderWidth: 0.7, borderColor: COR.borda }, style ?? {}]}>
      {titulo && <Text style={[base.tituloQuadro, { backgroundColor: cor }]}>{titulo}</Text>}
      {children}
    </View>
  );
}

/** Caixa rótulo/valor (cabeçalho, leituras) */
export function Campo({
  rotulo,
  valor,
  destaque,
  cor,
  flex = 1,
  alinhar = "left",
  tamanho,
}: {
  rotulo: string;
  valor: ReactNode;
  destaque?: boolean;
  cor?: string;
  flex?: number;
  alinhar?: "left" | "center" | "right";
  /** Tamanho da fonte do valor */
  tamanho?: number;
}) {
  return (
    <View
      style={{
        flex,
        borderWidth: 0.7,
        borderColor: destaque && cor ? cor : COR.borda,
        backgroundColor: destaque && cor ? cor : "#ffffff",
        paddingHorizontal: 5,
        paddingVertical: destaque ? 4 : 3,
      }}
    >
      <Text style={[base.rotulo, { textAlign: alinhar }, destaque ? { color: "#ffffff" } : {}]}>{rotulo}</Text>
      <Text
        style={{
          fontFamily: "Helvetica-Bold",
          fontSize: tamanho ?? (destaque ? 12.5 : 7.6),
          marginTop: 1.5,
          textAlign: alinhar,
          color: destaque ? "#ffffff" : COR.texto,
        }}
      >
        {valor}
      </Text>
    </View>
  );
}

/* ------------------------------ tabela ------------------------------ */

export interface Coluna {
  titulo: string;
  flex: number;
  alinhar?: "left" | "right" | "center";
}

export function Tabela({
  colunas,
  linhas,
  rodape,
  corCabecalho = COR.fundo,
  tamanho = 6.6,
  destacarUltima = false,
}: {
  colunas: Coluna[];
  linhas: ReactNode[][];
  rodape?: ReactNode[];
  corCabecalho?: string;
  tamanho?: number;
  destacarUltima?: boolean;
}) {
  const celula = (c: Coluna, i: number, ultima: boolean): Estilo => ({
    flex: c.flex,
    textAlign: c.alinhar ?? (i === 0 ? "left" : "right"),
    paddingHorizontal: 2.5,
    paddingVertical: 1.8,
    borderRightWidth: ultima ? 0 : 0.4,
    borderRightColor: COR.bordaClara,
  });
  return (
    <View>
      <View style={[base.linha, { backgroundColor: corCabecalho, borderBottomWidth: 0.6, borderBottomColor: COR.borda }]}>
        {colunas.map((c, i) => (
          <Text
            key={c.titulo}
            style={[
              celula(c, i, i === colunas.length - 1),
              { fontFamily: "Helvetica-Bold", fontSize: tamanho - 1.3, color: COR.suave, textTransform: "uppercase" },
            ]}
          >
            {c.titulo}
          </Text>
        ))}
      </View>
      {linhas.map((linha, li) => (
        <View
          key={li}
          wrap={false}
          style={[
            base.linha,
            { borderBottomWidth: 0.4, borderBottomColor: COR.bordaClara },
            destacarUltima && li === linhas.length - 1 ? { backgroundColor: "#fbf5e6" } : {},
          ]}
        >
          {linha.map((v, i) => (
            <Text key={i} style={[celula(colunas[i], i, i === linha.length - 1), { fontSize: tamanho }]}>
              {v}
            </Text>
          ))}
        </View>
      ))}
      {rodape && (
        <View style={[base.linha, { backgroundColor: COR.fundo }]}>
          {rodape.map((v, i) => (
            <Text
              key={i}
              style={[celula(colunas[i], i, i === rodape.length - 1), { fontSize: tamanho, fontFamily: "Helvetica-Bold" }]}
            >
              {v}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

/* ------------------------------ gráficos ------------------------------ */

/** Barras verticais (13 meses); a última barra (mês atual) em destaque */
export function GraficoColunas({
  valores,
  rotulos,
  cor,
  corDestaque,
  altura = 52,
}: {
  valores: number[];
  rotulos: string[];
  cor: string;
  corDestaque: string;
  altura?: number;
}) {
  const max = Math.max(1, ...valores);
  return (
    <View>
      <View style={[base.linha, { height: altura, alignItems: "flex-end", borderBottomWidth: 0.6, borderBottomColor: COR.borda }]}>
        {valores.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end", height: altura }}>
            <View
              style={{
                width: "62%",
                height: Math.max(0.5, (v / max) * (altura - 4)),
                backgroundColor: i === valores.length - 1 ? corDestaque : cor,
              }}
            />
          </View>
        ))}
      </View>
      <View style={base.linha}>
        {rotulos.map((r, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 3.9, textAlign: "center", color: COR.suave, marginTop: 1.5 }}>
            {r}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Pares de barras verticais (livre × cativo) */
export function GraficoPares({
  pares,
  rotulos,
  cores,
  altura = 110,
}: {
  pares: [number, number][];
  rotulos: string[];
  cores: [string, string];
  altura?: number;
}) {
  const max = Math.max(1, ...pares.flat());
  return (
    <View>
      <View style={[base.linha, { height: altura, alignItems: "flex-end", borderBottomWidth: 0.6, borderBottomColor: COR.borda }]}>
        {pares.map(([a, b], i) => (
          <View key={i} style={[base.linha, { flex: 1, justifyContent: "center", alignItems: "flex-end", height: altura }]}>
            <View style={{ width: "32%", height: Math.max(0.5, (a / max) * (altura - 4)), backgroundColor: cores[0] }} />
            <View style={{ width: 1.5 }} />
            <View style={{ width: "32%", height: Math.max(0.5, (b / max) * (altura - 4)), backgroundColor: cores[1] }} />
          </View>
        ))}
      </View>
      <View style={base.linha}>
        {rotulos.map((r, i) => (
          <Text key={i} style={{ flex: 1, fontSize: 5.2, textAlign: "center", color: COR.suave, marginTop: 2 }}>
            {r}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Onde a fatura real teria código de barras / QR code / linha digitável */
export function BlocoSemPagamento({ vencimento, total }: { vencimento: string; total: string }) {
  return (
    <View
      wrap={false}
      style={{
        marginTop: 6,
        borderWidth: 1.2,
        borderStyle: "dashed",
        borderColor: COR.simulacao,
        paddingVertical: 8,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, color: COR.simulacao, letterSpacing: 0.5 }}>
          SIMULAÇÃO — sem código de pagamento
        </Text>
        <Text style={{ fontSize: 6.4, color: COR.suave, marginTop: 3 }}>
          Este documento não tem código de barras, QR code nem linha digitável. Ele não pode e não deve ser pago em banco,
          aplicativo ou lotérica.
        </Text>
      </View>
      <View style={{ width: 150, borderLeftWidth: 0.6, borderLeftColor: COR.bordaClara, paddingLeft: 8 }}>
        <Text style={base.rotulo}>Vencimento (simulado)</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{vencimento}</Text>
        <Text style={[base.rotulo, { marginTop: 2 }]}>Valor (simulado)</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8 }}>{total}</Text>
      </View>
    </View>
  );
}

/** Carimbo "SIMULAÇÃO" no cabeçalho */
export function Carimbo() {
  return (
    <View
      style={{
        borderWidth: 1.4,
        borderColor: COR.simulacao,
        paddingHorizontal: 6,
        paddingVertical: 2,
        transform: "rotate(-4deg)",
        alignSelf: "flex-end",
      }}
    >
      <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: COR.simulacao, letterSpacing: 1 }}>SIMULAÇÃO</Text>
      <Text style={{ fontSize: 5.2, color: COR.simulacao, textAlign: "center" }}>SEM VALOR FISCAL</Text>
    </View>
  );
}
