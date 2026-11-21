import type { Bandeira, StatusConta, TipoCondominio, TipoFaturaEnergia } from "@/lib/tipos";

export const ROTULOS_BANDEIRA: Record<Bandeira, string> = {
  verde: "Verde",
  amarela: "Amarela",
  vermelha_1: "Vermelha — patamar 1",
  vermelha_2: "Vermelha — patamar 2",
  escassez_hidrica: "Escassez hídrica",
};

export const ROTULOS_TIPO_FATURA: Record<TipoFaturaEnergia, string> = {
  completa: "Fatura completa",
  distribuicao: "Distribuição (uso da rede)",
  energia_livre: "Energia do mercado livre",
};

export const ROTULOS_TIPO_CONDOMINIO: Record<TipoCondominio, string> = {
  horizontal: "Condomínio de casas",
  vertical: "Edifício residencial",
};

export const ROTULOS_STATUS: Record<StatusConta, string> = {
  vencida: "Vencidas",
  vence_em_breve: "Vencem em 7 dias",
  a_vencer: "A vencer",
  paga: "Pagas",
};

/** Ordem de prioridade dos status (o que exige ação primeiro) */
export const ORDEM_STATUS: StatusConta[] = ["vencida", "vence_em_breve", "a_vencer", "paga"];
