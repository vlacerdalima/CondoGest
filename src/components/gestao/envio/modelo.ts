/**
 * Modelo do formulário de envio de conta: estado (strings, como nos inputs),
 * conversão da extração automática → formulário, validação, detecção de
 * duplicidade e montagem da Conta final.
 */
import { centavos } from "@/lib/prng";
import { CONDOMINIOS, diferencaEmDias, obterUc } from "@/lib/dados";
import type { NovaConta } from "@/lib/dados/store";
import { ROTULOS_CATEGORIA } from "@/lib/formatacao";
import type { Bandeira, Categoria, Conta, ContaExtraida, TipoFaturaEnergia } from "@/lib/tipos";

export interface FormularioConta {
  condominioId: string;
  categoria: Categoria | "";
  fornecedor: string;
  descricao: string;
  competencia: string;
  emissao: string;
  vencimento: string;
  valor: string;
  paga: boolean;
  pagaEm: string;
  observacoes: string;
  // energia
  ucId: string;
  tipoFatura: TipoFaturaEnergia | "";
  leituraAnterior: string;
  leituraAtual: string;
  consumoKwh: string;
  bandeira: Bandeira | "";
  demandaMedidaKw: string;
  consumoPontaKwh: string;
  consumoForaPontaKwh: string;
  // água e gás
  consumoM3: string;
  diasCiclo: string;
}

export type CampoFormulario = keyof FormularioConta;

export const FORMULARIO_VAZIO: FormularioConta = {
  condominioId: "",
  categoria: "",
  fornecedor: "",
  descricao: "",
  competencia: "",
  emissao: "",
  vencimento: "",
  valor: "",
  paga: false,
  pagaEm: "",
  observacoes: "",
  ucId: "",
  tipoFatura: "",
  leituraAnterior: "",
  leituraAtual: "",
  consumoKwh: "",
  bandeira: "",
  demandaMedidaKw: "",
  consumoPontaKwh: "",
  consumoForaPontaKwh: "",
  consumoM3: "",
  diasCiclo: "",
};

/* ------------------------------ números ------------------------------ */

/** Aceita "1.234,56", "1234,56", "1234.56", "R$ 1.234,56" → 1234.56 */
export function lerNumero(texto: string): number | undefined {
  const limpo = texto.replace(/[^\d,.-]/g, "");
  if (!limpo || !/\d/.test(limpo)) return undefined;
  let normal: string;
  if (limpo.includes(",")) {
    normal = limpo.replace(/\./g, "").replace(",", ".");
  } else {
    const partes = limpo.split(".");
    // "1.234" ou "1.234.567" = milhar; "12.5" = decimal
    normal = partes.length > 2 || (partes.length === 2 && partes[1].length === 3) ? partes.join("") : limpo;
  }
  const n = Number(normal);
  return Number.isFinite(n) ? n : undefined;
}

/** 1234.5 → "1234,50" (para pôr num campo editável) */
export const paraCampoMoeda = (v: number) => v.toFixed(2).replace(".", ",");
const paraCampoNumero = (v: number) => String(v).replace(".", ",");

const dataValida = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

export function diasEntre(anterior: string, atual: string) {
  if (!dataValida(anterior) || !dataValida(atual)) return undefined;
  return diferencaEmDias(anterior, atual);
}

/* ------------------------------ extração ------------------------------ */

/** Converte o que a leitura automática encontrou em valores do formulário */
export function formularioDaExtracao(campos: ContaExtraida): { form: FormularioConta; lidos: Set<CampoFormulario> } {
  const form: FormularioConta = { ...FORMULARIO_VAZIO };
  const lidos = new Set<CampoFormulario>();
  const definir = <K extends CampoFormulario>(campo: K, valor: FormularioConta[K] | undefined | null) => {
    if (valor === undefined || valor === null || valor === "") return;
    form[campo] = valor;
    lidos.add(campo);
  };

  const uc = campos.energia?.ucId ? obterUc(campos.energia.ucId) : undefined;
  const condominioId = campos.condominioId ?? uc?.condominioId;
  if (condominioId && CONDOMINIOS.some((c) => c.id === condominioId)) definir("condominioId", condominioId);
  definir("categoria", campos.categoria);
  definir("fornecedor", campos.fornecedor);
  definir("descricao", campos.descricao);
  if (campos.competencia && /^\d{4}-\d{2}$/.test(campos.competencia)) definir("competencia", campos.competencia);
  if (campos.emissao && dataValida(campos.emissao)) definir("emissao", campos.emissao);
  if (campos.vencimento && dataValida(campos.vencimento)) definir("vencimento", campos.vencimento);
  if (typeof campos.valor === "number" && campos.valor > 0) definir("valor", paraCampoMoeda(campos.valor));
  if (campos.pagaEm && dataValida(campos.pagaEm)) {
    form.paga = true;
    definir("pagaEm", campos.pagaEm);
  }
  definir("observacoes", campos.observacoes);

  const e = campos.energia;
  if (e) {
    if (uc && (!form.condominioId || uc.condominioId === form.condominioId)) definir("ucId", uc.id);
    definir("tipoFatura", e.tipoFatura);
    if (e.leituraAnterior && dataValida(e.leituraAnterior)) definir("leituraAnterior", e.leituraAnterior);
    if (e.leituraAtual && dataValida(e.leituraAtual)) definir("leituraAtual", e.leituraAtual);
    if (typeof e.consumoKwh === "number") definir("consumoKwh", paraCampoNumero(e.consumoKwh));
    definir("bandeira", e.bandeira);
    if (typeof e.demandaMedidaKw === "number") definir("demandaMedidaKw", paraCampoNumero(e.demandaMedidaKw));
    if (typeof e.consumoPontaKwh === "number") definir("consumoPontaKwh", paraCampoNumero(e.consumoPontaKwh));
    if (typeof e.consumoForaPontaKwh === "number") definir("consumoForaPontaKwh", paraCampoNumero(e.consumoForaPontaKwh));
  }
  if (campos.agua) {
    definir("consumoM3", paraCampoNumero(campos.agua.consumoM3));
    definir("diasCiclo", String(campos.agua.dias));
  }
  if (campos.gas) definir("consumoM3", paraCampoNumero(campos.gas.consumoM3));

  return { form, lidos };
}

/* ------------------------------ validação ------------------------------ */

export type Erros = Partial<Record<CampoFormulario, string>>;

export function validar(form: FormularioConta): Erros {
  const erros: Erros = {};
  if (!form.condominioId) erros.condominioId = "Escolha o condomínio.";
  if (!form.categoria) erros.categoria = "Escolha a categoria.";
  if (!form.fornecedor.trim()) erros.fornecedor = "Informe o fornecedor.";
  if (!/^\d{4}-\d{2}$/.test(form.competencia)) erros.competencia = "Escolha o mês de referência.";
  if (!form.vencimento) erros.vencimento = "Informe o vencimento.";
  else if (!dataValida(form.vencimento)) erros.vencimento = "Data inválida.";
  if (form.emissao && !dataValida(form.emissao)) erros.emissao = "Data inválida.";
  if (form.emissao && dataValida(form.emissao) && dataValida(form.vencimento) && form.emissao > form.vencimento) {
    erros.emissao = "A emissão não pode ser depois do vencimento.";
  }
  const valor = lerNumero(form.valor);
  if (!form.valor.trim()) erros.valor = "Informe o valor.";
  else if (valor === undefined) erros.valor = "Valor inválido. Use, por exemplo, 1.234,56.";
  else if (valor <= 0) erros.valor = "O valor precisa ser maior que zero.";
  if (form.paga) {
    if (!form.pagaEm) erros.pagaEm = "Informe a data do pagamento.";
    else if (!dataValida(form.pagaEm)) erros.pagaEm = "Data inválida.";
  }

  if (form.categoria === "energia") {
    const uc = obterUc(form.ucId);
    if (!uc || uc.condominioId !== form.condominioId) erros.ucId = "Escolha a unidade consumidora.";
    if (!form.tipoFatura) erros.tipoFatura = "Escolha o tipo de fatura.";
    if (!form.leituraAnterior) erros.leituraAnterior = "Informe a leitura anterior.";
    else if (!dataValida(form.leituraAnterior)) erros.leituraAnterior = "Data inválida.";
    if (!form.leituraAtual) erros.leituraAtual = "Informe a leitura atual.";
    else if (!dataValida(form.leituraAtual)) erros.leituraAtual = "Data inválida.";
    const dias = diasEntre(form.leituraAnterior, form.leituraAtual);
    if (dias !== undefined && (dias <= 0 || dias > 62)) {
      erros.leituraAtual = dias <= 0 ? "A leitura atual precisa ser depois da anterior." : "Ciclo longo demais (mais de 62 dias).";
    }
    const kwh = lerNumero(form.consumoKwh);
    if (!form.consumoKwh.trim()) erros.consumoKwh = "Informe o consumo em kWh.";
    else if (kwh === undefined || kwh <= 0) erros.consumoKwh = "O consumo precisa ser maior que zero.";
    if (!form.bandeira) erros.bandeira = "Escolha a bandeira tarifária.";
    if (uc?.subgrupo === "A4") {
      const demanda = form.demandaMedidaKw ? lerNumero(form.demandaMedidaKw) : 0;
      if (demanda === undefined || demanda < 0) erros.demandaMedidaKw = "Valor inválido.";
      const ponta = form.consumoPontaKwh ? lerNumero(form.consumoPontaKwh) : undefined;
      const fora = form.consumoForaPontaKwh ? lerNumero(form.consumoForaPontaKwh) : undefined;
      if (form.consumoPontaKwh && (ponta === undefined || ponta < 0)) erros.consumoPontaKwh = "Valor inválido.";
      if (form.consumoForaPontaKwh && (fora === undefined || fora < 0)) erros.consumoForaPontaKwh = "Valor inválido.";
      if (kwh && ponta !== undefined && fora !== undefined && Math.abs(ponta + fora - kwh) > Math.max(2, kwh * 0.02)) {
        erros.consumoForaPontaKwh = "Ponta + fora de ponta deve dar o consumo total.";
      }
    }
  }

  if (form.categoria === "agua" || form.categoria === "gas") {
    const m3 = form.consumoM3 ? lerNumero(form.consumoM3) : undefined;
    if (form.categoria === "agua" && !form.consumoM3.trim()) erros.consumoM3 = "Informe o consumo em m³.";
    else if (form.consumoM3 && (m3 === undefined || m3 < 0)) erros.consumoM3 = "Valor inválido.";
    if (form.diasCiclo) {
      const d = lerNumero(form.diasCiclo);
      if (d === undefined || d < 1 || d > 62) erros.diasCiclo = "Entre 1 e 62 dias.";
    }
  }
  return erros;
}

/* ------------------------------ duplicidade ------------------------------ */

const normalizar = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * Contas que parecem a mesma: mesma UC + competência + tipo de fatura
 * (energia); mesmo condomínio + categoria + competência (água e gás); e, para
 * as demais categorias (que têm várias contas por mês), o mesmo fornecedor.
 */
export function encontrarDuplicadas(form: FormularioConta, contas: Conta[]): Conta[] {
  if (!form.condominioId || !form.categoria || !/^\d{4}-\d{2}$/.test(form.competencia)) return [];
  return contas.filter((c) => {
    if (c.condominioId !== form.condominioId || c.competencia !== form.competencia || c.categoria !== form.categoria) return false;
    if (form.categoria === "energia") {
      if (!form.ucId || c.energia?.ucId !== form.ucId) return false;
      return !form.tipoFatura || c.energia?.tipoFatura === form.tipoFatura;
    }
    if (form.categoria === "agua" || form.categoria === "gas") return true;
    return form.fornecedor.trim() !== "" && normalizar(c.fornecedor) === normalizar(form.fornecedor);
  });
}

/* ------------------------------ sugestões ------------------------------ */

/** Fornecedor mais usado pelo condomínio nesta categoria (para pré-preencher) */
export function fornecedorSugerido(contas: Conta[], condominioId: string, categoria: Categoria) {
  const contagem = new Map<string, number>();
  for (const c of contas) {
    if (c.condominioId === condominioId && c.categoria === categoria) contagem.set(c.fornecedor, (contagem.get(c.fornecedor) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** Fornecedores já usados na categoria (lista de sugestões do campo) */
export function fornecedoresDaCategoria(contas: Conta[], categoria: Categoria | "") {
  const nomes = new Set<string>();
  for (const c of contas) if (!categoria || c.categoria === categoria) nomes.add(c.fornecedor);
  return [...nomes].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function descricaoPadrao(form: FormularioConta) {
  if (form.categoria === "energia") {
    const uc = obterUc(form.ucId);
    const tipo = form.tipoFatura === "distribuicao" ? " (distribuição)" : form.tipoFatura === "energia_livre" ? " (mercado livre)" : "";
    return `Energia${tipo}${uc ? ` — ${uc.apelido}` : ""}`;
  }
  if (form.categoria === "agua") return "Água e esgoto";
  if (!form.categoria) return "";
  return `${ROTULOS_CATEGORIA[form.categoria]}${form.fornecedor.trim() ? ` — ${form.fornecedor.trim()}` : ""}`;
}

/* ------------------------------ montagem ------------------------------ */

/** Monta a conta final (já validada) — itens/tributos lidos são preservados quando batem com o valor */
export function montarConta(form: FormularioConta, extraida?: ContaExtraida): NovaConta {
  const valor = centavos(lerNumero(form.valor) ?? 0);
  const categoria = form.categoria as Categoria;
  const conta: NovaConta = {
    condominioId: form.condominioId,
    categoria,
    fornecedor: form.fornecedor.trim(),
    descricao: form.descricao.trim() || descricaoPadrao(form),
    competencia: form.competencia,
    vencimento: form.vencimento,
    valor,
    ...(form.emissao && { emissao: form.emissao }),
    ...(form.paga && form.pagaEm && { pagaEm: form.pagaEm }),
    ...(form.observacoes.trim() && { observacoes: form.observacoes.trim() }),
  };

  if (categoria === "energia") {
    const uc = obterUc(form.ucId)!;
    const lida = extraida?.energia;
    const mesmaUc = lida && (!lida.ucId || lida.ucId === uc.id);
    const somaItens = lida?.itens?.reduce((s, i) => s + i.valor, 0) ?? 0;
    const itens =
      mesmaUc && lida?.itens?.length && Math.abs(somaItens - valor) < 0.05 ? lida.itens : [{ descricao: "Total da fatura", valor }];
    const consumoKwh = Math.round(lerNumero(form.consumoKwh) ?? 0);
    const ehGrupoA = uc.subgrupo === "A4";
    const num = (t: string) => (t.trim() ? lerNumero(t) : undefined);
    conta.energia = {
      ucId: uc.id,
      tipoFatura: form.tipoFatura as TipoFaturaEnergia,
      leituraAnterior: form.leituraAnterior,
      leituraAtual: form.leituraAtual,
      dias: diasEntre(form.leituraAnterior, form.leituraAtual) ?? 30,
      consumoKwh,
      bandeira: form.bandeira as Bandeira,
      ...(ehGrupoA && {
        demandaContratadaKw: uc.demandaContratadaKw,
        ...(num(form.demandaMedidaKw) !== undefined && { demandaMedidaKw: num(form.demandaMedidaKw) }),
        ...(num(form.consumoPontaKwh) !== undefined && { consumoPontaKwh: Math.round(num(form.consumoPontaKwh)!) }),
        ...(num(form.consumoForaPontaKwh) !== undefined && { consumoForaPontaKwh: Math.round(num(form.consumoForaPontaKwh)!) }),
        ...(mesmaUc && lida?.demandaMedidaPontaKw !== undefined && { demandaMedidaPontaKw: lida.demandaMedidaPontaKw }),
      }),
      ...(mesmaUc && lida?.reativoExcedenteKvarh !== undefined && { reativoExcedenteKvarh: lida.reativoExcedenteKvarh }),
      ...(mesmaUc && lida?.precoEnergiaLivreMwh !== undefined && { precoEnergiaLivreMwh: lida.precoEnergiaLivreMwh }),
      ...(mesmaUc && lida?.custoEquivalenteCativo !== undefined && { custoEquivalenteCativo: lida.custoEquivalenteCativo }),
      itens,
      tributos: mesmaUc && lida?.tributos ? lida.tributos : { pis: 0, cofins: 0, icms: 0 },
    };
  }
  if (categoria === "agua") {
    conta.agua = { consumoM3: lerNumero(form.consumoM3) ?? 0, dias: Math.round(lerNumero(form.diasCiclo) ?? 30) };
  }
  if (categoria === "gas" && form.consumoM3.trim()) {
    conta.gas = { consumoM3: lerNumero(form.consumoM3) ?? 0 };
  }
  return conta;
}
