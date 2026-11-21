/**
 * Energia — base de análise de um condomínio.
 *
 * Junta tudo o que as recomendações, a comprovação e as telas precisam:
 * séries por UC e do condomínio, avaliação mês a mês (anomalias), tarifas
 * efetivas, mercado livre, bandeiras, linha de base e avisos sobre os dados.
 */
import { somarMeses } from "../dados/referencia";
import type { Competencia, Condominio, Conta, UnidadeConsumidora } from "../tipos";
import {
  avaliarSerie,
  calcularLinhaDeBase,
  detectarEpisodios,
  type EpisodioAnomalia,
  type LinhaDeBase,
  type PontoAvaliado,
} from "./energia-anomalias";
import {
  calcularTarifas,
  competenciasEntre,
  contasDeEnergia,
  dadosPorUc,
  descreverUc,
  montarSerie,
  resumirBandeiras,
  resumirMercadoLivre,
  type DadosEnergiaUc,
  type MesEnergiaUc,
  type PontoSerie,
  type ResumoBandeiras,
  type ResumoMercadoLivre,
  type TarifasUc,
} from "./energia-dados";
import { formatarCompetencia } from "../formatacao";

export interface AnaliseUc {
  uc: UnidadeConsumidora;
  /** "Média tensão · mercado livre", "Baixa tensão"… */
  descricao: string;
  /** Posição fixa da UC no condomínio (1, 2…) — define a cor da série */
  ordem: number;
  meses: MesEnergiaUc[];
  serie: PontoSerie[];
  avaliacao: PontoAvaliado[];
  episodios: EpisodioAnomalia[];
  /** Meses completos dentro da janela de 12 meses do condomínio */
  janela: MesEnergiaUc[];
  tarifas: TarifasUc;
  mercadoLivre?: ResumoMercadoLivre;
  ultimoMes?: MesEnergiaUc;
}

export interface AvisoDados {
  tom: "info" | "atencao";
  texto: string;
}

export interface BaseAnalise {
  condominio: Condominio;
  ucs: AnaliseUc[];
  dados: DadosEnergiaUc[];
  /** Série do condomínio (todas as UCs) */
  serie: PontoSerie[];
  avaliacao: PontoAvaliado[];
  /** Último mês com TODAS as faturas de todas as UCs */
  ultimoMesCompleto?: Competencia;
  ultimoPonto?: PontoSerie;
  /** Últimos 12 meses até o último mês completo */
  competenciasJanela: Competencia[];
  /** Linha de base de kWh/dia (12 meses antes do último mês completo) */
  linhaDeBase: LinhaDeBase | null;
  bandeiras: ResumoBandeiras;
  /** Episódios de anomalia de todas as UCs */
  episodios: EpisodioAnomalia[];
  mesesDeHistorico: number;
  avisos: AvisoDados[];
  contasEnviadas: number;
}

function entradas(serie: PontoSerie[]) {
  return serie.filter((p) => p.kwh > 0).map((p) => ({ competencia: p.competencia, valor: p.kwhDia, ocupadas: p.ocupadas, dias: p.dias }));
}

export function montarBaseAnalise(condominio: Condominio, contas: Conta[]): BaseAnalise {
  const dados = dadosPorUc(condominio, contas);
  const serie = montarSerie(condominio, dados);
  const avaliacao = avaliarSerie(entradas(serie));
  const completos = serie.filter((p) => p.completo && p.kwh > 0);
  const ultimoPonto = completos[completos.length - 1];
  const ultimoMesCompleto = ultimoPonto?.competencia;
  const competenciasJanela = ultimoMesCompleto ? competenciasEntre(somarMeses(ultimoMesCompleto, -11), ultimoMesCompleto) : [];

  const ucs: AnaliseUc[] = dados.map((d, i) => {
    const serieUc = montarSerie(condominio, [d]);
    const janela = d.meses.filter((m) => m.completo && competenciasJanela.includes(m.competencia));
    const baseTarifas = janela.length ? janela : d.meses.slice(-12);
    const tarifas = calcularTarifas(d.uc, baseTarifas);
    const avaliacaoUc = avaliarSerie(entradas(serieUc));
    const ultimaAvaliada = avaliacaoUc[avaliacaoUc.length - 1]?.competencia;
    const completosUc = d.meses.filter((m) => m.completo);
    return {
      uc: d.uc,
      descricao: descreverUc(d.uc),
      ordem: i + 1,
      meses: d.meses,
      serie: serieUc,
      avaliacao: avaliacaoUc,
      episodios: detectarEpisodios(avaliacaoUc, tarifas.reaisPorKwhVariavel, ultimaAvaliada, d.uc.id),
      janela,
      tarifas,
      mercadoLivre: resumirMercadoLivre(d.meses, ultimoMesCompleto),
      ultimoMes: completosUc[completosUc.length - 1],
    };
  });

  const anomalos = new Set(avaliacao.filter((p) => p.status !== "normal" && p.status !== "sem_referencia").map((p) => p.competencia));
  const linhaDeBase = ultimoMesCompleto
    ? calcularLinhaDeBase(
        serie.map((p) => ({ competencia: p.competencia, valor: p.kwhDia, ocupadas: p.ocupadas, anomalo: anomalos.has(p.competencia) })),
        ultimoMesCompleto,
      )
    : null;

  const avisos: AvisoDados[] = [];
  const mesesDeHistorico = serie.filter((p) => p.kwh > 0).length;
  if (!mesesDeHistorico) {
    avisos.push({ tom: "atencao", texto: "Ainda não há contas de energia deste condomínio. Envie as contas para começar a análise." });
  } else if (mesesDeHistorico < 12) {
    avisos.push({
      tom: "atencao",
      texto: `Só há ${mesesDeHistorico} ${mesesDeHistorico === 1 ? "mês" : "meses"} de contas: a linha de base é parcial e as estimativas ficam menos precisas (o ideal são 12 meses).`,
    });
  }
  for (const p of serie) {
    if (ultimoMesCompleto && p.competencia > ultimoMesCompleto && !p.completo) {
      const faltam: string[] = [];
      for (const d of dados) {
        const mes = d.meses.find((m) => m.competencia === p.competencia);
        if (!mes) {
          if (d.meses.some((m) => m.competencia < p.competencia)) faltam.push(`a conta "${d.uc.apelido}"`);
        } else if (mes.faltando.length) {
          faltam.push(
            mes.faltando.includes("energia_livre")
              ? `a fatura da comercializadora de "${d.uc.apelido}"`
              : `a fatura da distribuidora de "${d.uc.apelido}"`,
          );
        }
      }
      avisos.push({
        tom: "info",
        texto: `${formatarCompetencia(p.competencia)} ainda está incompleto${faltam.length ? ` (falta ${faltam.join(" e ")})` : ""}: as análises usam até ${formatarCompetencia(ultimoMesCompleto)}.`,
      });
    }
  }
  for (const d of dados) {
    if (!d.meses.length) avisos.push({ tom: "info", texto: `A conta "${d.uc.apelido}" ainda não tem faturas no sistema.` });
  }

  const contasEnviadas = contasDeEnergia(contas).filter(
    (c) => c.condominioId === condominio.id && c.origem === "envio",
  ).length;

  return {
    condominio,
    ucs,
    dados,
    serie,
    avaliacao,
    ultimoMesCompleto,
    ultimoPonto,
    competenciasJanela,
    linhaDeBase,
    bandeiras: resumirBandeiras(dados, competenciasJanela),
    episodios: ucs.flatMap((u) => u.episodios),
    mesesDeHistorico,
    avisos,
    contasEnviadas,
  };
}
