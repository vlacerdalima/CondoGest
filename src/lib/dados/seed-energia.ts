/**
 * Contas de energia da demonstração — geradas pelo gerador de contas
 * fictícias (src/lib/gerador), com os perfis calibrados em
 * src/lib/gerador/perfis.ts.
 *
 * DONO: agente "Gerador".
 *
 * Regras (mantidas):
 *  - determinística (PRNG com semente fixa; nada de Math.random/Date.now);
 *  - uma conta por UC por competência em COMPETENCIAS_DEMO, exceto UCs no
 *    mercado livre, que têm DUAS contas por competência: "distribuicao"
 *    (distribuidora, TUSD) e "energia_livre" (comercializadora);
 *  - categoria "energia", origem "demo", campo `energia` preenchido;
 *  - `valor` = soma dos itens da fatura;
 *  - pagas até a DATA_REFERENCIA (com pagaEm), em aberto depois
 *    (exceção proposital: história "d" abaixo).
 *
 * Observação para as análises: no mercado livre as duas contas repetem as
 * grandezas medidas (consumoKwh, ponta, demanda). Para consumo físico use só
 * as contas "completa" e "distribuicao"; a "energia_livre" é o custo da energia.
 *
 * HISTÓRIAS EMBUTIDAS NOS DADOS (para as análises genéricas detectarem):
 *  (a) Reserva das Palmeiras, BT (uc-rp-bt): iluminação viária com fotocélulas
 *      queimadas → postes acesos de dia. kWh/dia ≈ +15% em 2026-09 e ≈ +18%
 *      de 2026-10 em diante (NÃO normalizou em 2026-11; continua nas competências
 *      futuras geradas na página).
 *  (b) Mirante do Capibaribe (uc-mc-mt, A4 verde cativo, 90 kW): fator de
 *      potência baixo (0,86–0,89) → reativo excedente cobrado em 2025-10..2026-01,
 *      2026-04..2026-05 e de 2026-07 em diante. Consumo alto (~20–23 MWh/mês),
 *      pouca ponta (~8,5%) e fator de carga ~0,40: bom candidato ao mercado livre.
 *  (c) Bandeiras: calendário fictício com amarela/vermelha no 2º semestre de
 *      2026 (jul amarela, ago vermelha 1, set vermelha 2, out vermelha 1, nov
 *      amarela). As faturas aplicam cada bandeira pelos dias do ciclo; o campo
 *      `bandeira` é a predominante no ciclo (o ciclo da competência M cobre
 *      sobretudo o mês M−1).
 *  (d) Atlântico Sul (uc-as-bt): conta de 2026-11 VENCIDA (vencimento
 *      16/11/2026, sem pagaEm).
 *  (e) Villa Aldeia (uc-va-bt): consumo cresce suavemente com a ocupação
 *      (41 → 45 casas, elasticidade 1).
 *  (f) Reserva das Palmeiras, MT (uc-rp-mt, A4 verde livre): demanda contratada
 *      150 kW, mas a medida fica em ~60–95 kW (contrato superdimensionado);
 *      consumo na ponta ~14% (bombas do poço e ETE) — oportunidade de deslocar
 *      cargas. Economia do mercado livre vs. cativo ≈ 25–30% (custoEquivalenteCativo).
 *      Consumo cresce com a ocupação (52 → 64 casas, elasticidade 0,4).
 *  (g) Itens eventuais realistas: "ICMS-CDE", créditos "Comp. DIC Mês MM/AA"
 *      (negativos) e "Dif. Desc. Ft.Alter." (desconto de fonte incentivada).
 */
import { centavos, criarPrng } from "../prng";
import type { Conta } from "../tipos";
import { faturaParaConta } from "../gerador/conta";
import { gerarFaturas } from "../gerador/fatura";
import type { FaturaFicticia } from "../gerador/tipos";
import { UNIDADES_CONSUMIDORAS } from "./condominios";
import { COMPETENCIAS_DEMO, DATA_REFERENCIA, diferencaEmDias, somarDias } from "./referencia";

/** Contas que ficam em aberto mesmo com vencimento antes da DATA_REFERENCIA (história d) */
const CONTAS_EM_ATRASO = new Set(["en-uc-as-bt-2026-11"]);

function pagamento(id: string, f: FaturaFicticia) {
  if (f.vencimento >= DATA_REFERENCIA || CONTAS_EM_ATRASO.has(id)) return undefined;
  const rng = criarPrng(`pagamento:${id}`);
  const antecedencia = rng.chance(0.35) ? 0 : rng.inteiro(1, 5);
  const data = somarDias(f.vencimento, -antecedencia);
  return diferencaEmDias(f.emissao, data) < 1 ? somarDias(f.emissao, 1) : data;
}

function paraContaDemo(id: string, f: FaturaFicticia): Conta {
  return { ...faturaParaConta(f), id, origem: "demo", pagaEm: pagamento(id, f), valor: centavos(f.total) };
}

export function gerarContasEnergiaDemo(): Conta[] {
  const contas: Conta[] = [];
  for (const uc of UNIDADES_CONSUMIDORAS) {
    for (const competencia of COMPETENCIAS_DEMO) {
      const { principal, comercializadora } = gerarFaturas({ uc: uc.id, competencia }, { historicoComparativo: false });
      if (comercializadora) {
        contas.push(paraContaDemo(`en-${uc.id}-${competencia}-dist`, principal));
        contas.push(paraContaDemo(`en-${uc.id}-${competencia}-livre`, comercializadora));
      } else {
        contas.push(paraContaDemo(`en-${uc.id}-${competencia}`, principal));
      }
    }
  }
  return contas;
}
