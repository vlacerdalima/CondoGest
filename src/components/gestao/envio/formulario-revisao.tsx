"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, FileText, Info, Save, ScanText, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useId, useMemo, useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { estiloCampo } from "@/components/ui/page-header";
import { ORDEM_CATEGORIAS } from "@/lib/analise/geral";
import {
  COMPETENCIA_ATUAL,
  CONDOMINIOS,
  DATA_REFERENCIA,
  obterCondominio,
  obterUc,
  obterUcsDoCondominio,
  somarMeses,
  statusDaConta,
} from "@/lib/dados";
import { useContas, type NovaConta } from "@/lib/dados/store";
import {
  formatarCompetencia,
  formatarData,
  formatarKw,
  formatarKwhDia,
  formatarMoeda,
  formatarNumero1,
  ROTULOS_CATEGORIA,
} from "@/lib/formatacao";
import type { Bandeira, Categoria, Conta, ContaExtraida, TipoFaturaEnergia } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { IconeCategoria } from "../categoria";
import { formatarTamanhoArquivo } from "../formato";
import { ROTULOS_BANDEIRA, ROTULOS_TIPO_FATURA } from "../rotulos";
import {
  descricaoPadrao,
  diasEntre,
  encontrarDuplicadas,
  fornecedoresDaCategoria,
  fornecedorSugerido,
  lerNumero,
  montarConta,
  validar,
  type CampoFormulario,
  type FormularioConta,
} from "./modelo";

/** Competências oferecidas: 2 meses à frente até 3 anos para trás */
const COMPETENCIAS = Array.from({ length: 38 }, (_, i) => somarMeses(COMPETENCIA_ATUAL, 2 - i));

const ROTULOS_CAMPOS: Record<CampoFormulario, string> = {
  condominioId: "Condomínio",
  categoria: "Categoria",
  fornecedor: "Fornecedor",
  descricao: "Descrição",
  competencia: "Mês de referência",
  emissao: "Emissão",
  vencimento: "Vencimento",
  valor: "Valor",
  paga: "Paga",
  pagaEm: "Data do pagamento",
  observacoes: "Observações",
  ucId: "Unidade consumidora",
  tipoFatura: "Tipo de fatura",
  leituraAnterior: "Leitura anterior",
  leituraAtual: "Leitura atual",
  consumoKwh: "Consumo (kWh)",
  bandeira: "Bandeira",
  demandaMedidaKw: "Demanda medida",
  consumoPontaKwh: "Consumo na ponta",
  consumoForaPontaKwh: "Consumo fora da ponta",
  consumoM3: "Consumo (m³)",
  diasCiclo: "Dias do ciclo",
};

export interface DadosIniciaisRevisao {
  form: FormularioConta;
  lidos: Set<CampoFormulario>;
  extraida?: ContaExtraida;
  origem: "reconhecido" | "parcial" | "manual";
  fonte?: string;
  aviso?: string;
}

function SeloLido() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
      <ScanText className="size-3" aria-hidden />
      lido automaticamente
    </span>
  );
}

export function FormularioRevisao({
  inicial,
  arquivo,
  aoSalvar,
  aoVoltar,
}: {
  inicial: DadosIniciaisRevisao;
  arquivo: File | null;
  aoSalvar: (conta: NovaConta) => string | void;
  aoVoltar: () => void;
}) {
  const contas = useContas();
  const prefixo = useId();
  const [form, setForm] = useState<FormularioConta>(inicial.form);
  const [fornecedorAuto, setFornecedorAuto] = useState<string>("");
  const [tocados, setTocados] = useState<Set<CampoFormulario>>(new Set());
  const [tentou, setTentou] = useState(false);
  const [confirmouDuplicada, setConfirmouDuplicada] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const erros = validar(form);
  const duplicadas = useMemo(() => encontrarDuplicadas(form, contas), [form, contas]);
  const precisaConfirmar = duplicadas.length > 0 && !confirmouDuplicada;
  const sugestoesFornecedor = useMemo(() => fornecedoresDaCategoria(contas, form.categoria), [contas, form.categoria]);

  const uc = obterUc(form.ucId);
  const ucsDoCondominio = form.condominioId ? obterUcsDoCondominio(form.condominioId) : [];
  const dias = diasEntre(form.leituraAnterior, form.leituraAtual);
  const kwh = lerNumero(form.consumoKwh);
  const valor = lerNumero(form.valor);
  const m3 = lerNumero(form.consumoM3);

  const idCampo = (c: CampoFormulario) => `${prefixo}-${c}`;
  const erroDe = (c: CampoFormulario) => (tentou || tocados.has(c) ? erros[c] : undefined);
  const lido = (c: CampoFormulario) => inicial.lidos.has(c) && form[c] === inicial.form[c];

  /** Props de acessibilidade comuns aos campos */
  const a11y = (c: CampoFormulario, dica?: boolean) => ({
    id: idCampo(c),
    name: c,
    "aria-invalid": erroDe(c) ? true : undefined,
    "aria-describedby": [erroDe(c) && `${idCampo(c)}-erro`, dica && `${idCampo(c)}-dica`].filter(Boolean).join(" ") || undefined,
    onBlur: () => setTocados((t) => (t.has(c) ? t : new Set(t).add(c))),
  });

  /** Altera um campo e aplica as regras de preenchimento automático */
  function alterar<K extends CampoFormulario>(campo: K, valorNovo: FormularioConta[K]) {
    const f: FormularioConta = { ...form, [campo]: valorNovo };
    let novoAuto = fornecedorAuto;
    const podeTrocarFornecedor = !f.fornecedor.trim() || f.fornecedor === fornecedorAuto;
    const sugerirFornecedor = (nome: string | undefined) => {
      if (nome && podeTrocarFornecedor) {
        f.fornecedor = nome;
        novoAuto = nome;
      }
    };

    if (campo === "condominioId" || campo === "categoria") {
      const ucs = f.condominioId ? obterUcsDoCondominio(f.condominioId) : [];
      if (f.ucId && !ucs.some((u) => u.id === f.ucId)) {
        f.ucId = "";
        f.tipoFatura = "";
      }
      if (f.categoria === "energia" && !f.ucId && ucs.length === 1) {
        f.ucId = ucs[0].id;
        if (ucs[0].ambiente === "cativo") f.tipoFatura = "completa";
      }
      if (f.condominioId && f.categoria && f.categoria !== "energia") {
        sugerirFornecedor(fornecedorSugerido(contas, f.condominioId, f.categoria));
      }
    }
    if (campo === "ucId" || campo === "condominioId" || campo === "categoria" || campo === "tipoFatura") {
      const ucSel = obterUc(f.ucId);
      if (ucSel && f.categoria === "energia") {
        if (ucSel.ambiente === "cativo") f.tipoFatura = "completa";
        else if (f.tipoFatura === "completa") f.tipoFatura = "";
        sugerirFornecedor(f.tipoFatura === "energia_livre" ? ucSel.comercializadora : ucSel.distribuidora);
      }
    }
    if (campo === "vencimento" && typeof valorNovo === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valorNovo) && !f.competencia) {
      f.competencia = valorNovo.slice(0, 7);
    }
    if (campo === "paga" && valorNovo === true && !f.pagaEm) f.pagaEm = DATA_REFERENCIA;
    if (campo === "consumoPontaKwh" && uc?.subgrupo === "A4") {
      const total = lerNumero(f.consumoKwh);
      const ponta = lerNumero(f.consumoPontaKwh);
      if (total !== undefined && ponta !== undefined && ponta <= total && !tocados.has("consumoForaPontaKwh")) {
        f.consumoForaPontaKwh = String(Math.round(total - ponta));
      }
    }
    if (campo === "categoria" || campo === "condominioId" || campo === "competencia" || campo === "ucId" || campo === "tipoFatura") {
      setConfirmouDuplicada(false);
    }
    setFornecedorAuto(novoAuto);
    setForm(f);
  }

  function salvar(e: React.FormEvent) {
    e.preventDefault();
    setTentou(true);
    setErroSalvar(null);
    if (Object.keys(erros).length > 0 || precisaConfirmar) {
      requestAnimationFrame(() => document.getElementById(`${prefixo}-resumo-erros`)?.focus());
      return;
    }
    try {
      const erro = aoSalvar(montarConta(form, inicial.extraida));
      if (erro) setErroSalvar(erro);
    } catch (err) {
      setErroSalvar(err instanceof Error ? err.message : "Não foi possível salvar a conta.");
    }
  }

  const listaErros = Object.entries(erros) as [CampoFormulario, string][];

  // Prévia ao vivo da conta (lado direito)
  const condominio = obterCondominio(form.condominioId);
  const previa: Conta | undefined =
    form.categoria && valor
      ? {
          id: "previa",
          origem: "envio",
          condominioId: form.condominioId,
          categoria: form.categoria,
          fornecedor: form.fornecedor,
          descricao: form.descricao || descricaoPadrao(form),
          competencia: form.competencia,
          vencimento: form.vencimento,
          valor,
          pagaEm: form.paga && form.pagaEm ? form.pagaEm : undefined,
        }
      : undefined;

  return (
    <form onSubmit={salvar} noValidate className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
      <div className="space-y-6 lg:col-span-2">
        {/* Origem dos dados */}
        {inicial.origem === "reconhecido" && (
          <div className="flex items-start gap-3 rounded-xl border border-ok/30 bg-ok-soft px-4 py-3 text-sm">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-ok" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">Lemos a conta automaticamente</p>
              <p className="text-muted">
                Os campos com o selo <SeloLido /> vieram do arquivo{inicial.fonte ? ` (${inicial.fonte})` : ""}. Confira e corrija o que for
                preciso antes de salvar.
              </p>
            </div>
          </div>
        )}
        {inicial.origem === "parcial" && (
          <div className="flex items-start gap-3 rounded-xl border border-warn/40 bg-warn-soft px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warn" aria-hidden />
            <div>
              <p className="font-semibold text-foreground">Lemos só parte dos dados</p>
              <p className="text-muted">{inicial.aviso}</p>
            </div>
          </div>
        )}

        {tentou && (listaErros.length > 0 || precisaConfirmar) && (
          <div
            id={`${prefixo}-resumo-erros`}
            tabIndex={-1}
            role="alert"
            className="rounded-xl border border-critical/30 bg-critical-soft px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-critical"
          >
            <p className="font-semibold text-foreground">
              {listaErros.length > 0
                ? `Falta${listaErros.length === 1 ? "" : "m"} ${listaErros.length} ${listaErros.length === 1 ? "ajuste" : "ajustes"} para salvar:`
                : "Confirme que não é uma conta repetida:"}
            </p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-muted">
              {listaErros.map(([campo, msg]) => (
                <li key={campo}>
                  <a href={`#${idCampo(campo)}`} className="text-critical underline underline-offset-2">
                    {ROTULOS_CAMPOS[campo]}
                  </a>
                  : {msg}
                </li>
              ))}
              {precisaConfirmar && (
                <li>
                  <a href={`#${prefixo}-duplicada`} className="text-critical underline underline-offset-2">
                    Possível duplicidade
                  </a>
                  : marque a confirmação ou ajuste os dados.
                </li>
              )}
            </ul>
          </div>
        )}

        <Card className="p-5 sm:p-6">
          <Secao titulo="De quem é a conta" numero={1}>
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <Campo rotulo="Condomínio" obrigatorio erro={erroDe("condominioId")} id={idCampo("condominioId")} lido={lido("condominioId")}>
                <select
                  {...a11y("condominioId")}
                  value={form.condominioId}
                  onChange={(e) => alterar("condominioId", e.target.value)}
                  className={estiloCampo}
                >
                  <option value="">Selecione…</option>
                  {CONDOMINIOS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Categoria" obrigatorio erro={erroDe("categoria")} id={idCampo("categoria")} lido={lido("categoria")}>
                <select
                  {...a11y("categoria")}
                  value={form.categoria}
                  onChange={(e) => alterar("categoria", e.target.value as Categoria | "")}
                  className={estiloCampo}
                >
                  <option value="">Selecione…</option>
                  {ORDEM_CATEGORIAS.map((c) => (
                    <option key={c} value={c}>
                      {ROTULOS_CATEGORIA[c]}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo
                rotulo="Fornecedor"
                obrigatorio
                erro={erroDe("fornecedor")}
                id={idCampo("fornecedor")}
                lido={lido("fornecedor")}
                dica={fornecedorAuto && form.fornecedor === fornecedorAuto ? "sugerido pelo histórico" : undefined}
              >
                <input
                  {...a11y("fornecedor")}
                  list={`${prefixo}-fornecedores`}
                  value={form.fornecedor}
                  onChange={(e) => alterar("fornecedor", e.target.value)}
                  placeholder="Nome da empresa"
                  autoComplete="off"
                  className={estiloCampo}
                />
                <datalist id={`${prefixo}-fornecedores`}>
                  {sugestoesFornecedor.map((f) => (
                    <option key={f} value={f} />
                  ))}
                </datalist>
              </Campo>
              <Campo rotulo="Descrição" erro={erroDe("descricao")} id={idCampo("descricao")} lido={lido("descricao")} dica="opcional">
                <input
                  {...a11y("descricao")}
                  value={form.descricao}
                  onChange={(e) => alterar("descricao", e.target.value)}
                  placeholder={descricaoPadrao(form) || "Ex.: Manutenção mensal dos elevadores"}
                  className={estiloCampo}
                />
              </Campo>
            </div>
          </Secao>

          <Secao titulo="Valores e datas" numero={2}>
            <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
              <Campo rotulo="Valor" obrigatorio erro={erroDe("valor")} id={idCampo("valor")} lido={lido("valor")}>
                <div className="relative">
                  <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted">R$</span>
                  <input
                    {...a11y("valor", true)}
                    inputMode="decimal"
                    value={form.valor}
                    onChange={(e) => alterar("valor", e.target.value)}
                    placeholder="0,00"
                    className={cn(estiloCampo, "tabular pl-10")}
                  />
                </div>
                <p id={`${idCampo("valor")}-dica`} className="mt-1 text-xs text-muted">
                  {valor && valor > 0 ? `= ${formatarMoeda(valor)}` : "Use vírgula para os centavos: 1.234,56"}
                </p>
              </Campo>
              <Campo rotulo="Mês de referência" obrigatorio erro={erroDe("competencia")} id={idCampo("competencia")} lido={lido("competencia")}>
                <select
                  {...a11y("competencia")}
                  value={form.competencia}
                  onChange={(e) => alterar("competencia", e.target.value)}
                  className={estiloCampo}
                >
                  <option value="">Selecione…</option>
                  {COMPETENCIAS.map((c) => (
                    <option key={c} value={c}>
                      {formatarCompetencia(c)}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo rotulo="Vencimento" obrigatorio erro={erroDe("vencimento")} id={idCampo("vencimento")} lido={lido("vencimento")}>
                <input
                  {...a11y("vencimento")}
                  type="date"
                  value={form.vencimento}
                  onChange={(e) => alterar("vencimento", e.target.value)}
                  className={estiloCampo}
                />
              </Campo>
              <Campo rotulo="Emissão" erro={erroDe("emissao")} id={idCampo("emissao")} lido={lido("emissao")} dica="opcional">
                <input
                  {...a11y("emissao")}
                  type="date"
                  value={form.emissao}
                  onChange={(e) => alterar("emissao", e.target.value)}
                  className={estiloCampo}
                />
              </Campo>
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                  <input
                    type="checkbox"
                    checked={form.paga}
                    onChange={(e) => alterar("paga", e.target.checked)}
                    className="size-4 rounded border-border-strong accent-[var(--primary)]"
                  />
                  Esta conta já foi paga
                  {lido("pagaEm") && <SeloLido />}
                </label>
                {form.paga && (
                  <div className="mt-3 max-w-xs">
                    <Campo rotulo="Data do pagamento" obrigatorio erro={erroDe("pagaEm")} id={idCampo("pagaEm")}>
                      <input
                        {...a11y("pagaEm")}
                        type="date"
                        value={form.pagaEm}
                        onChange={(e) => alterar("pagaEm", e.target.value)}
                        className={estiloCampo}
                      />
                    </Campo>
                  </div>
                )}
              </div>
            </div>
          </Secao>

          {form.categoria === "energia" && (
            <Secao titulo="Detalhes da energia" numero={3} icone={<Zap className="size-4 text-energy" aria-hidden />}>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <Campo
                  rotulo="Unidade consumidora"
                  obrigatorio
                  erro={erroDe("ucId")}
                  id={idCampo("ucId")}
                  lido={lido("ucId")}
                  largo
                >
                  <select
                    {...a11y("ucId", true)}
                    value={form.ucId}
                    onChange={(e) => alterar("ucId", e.target.value)}
                    disabled={!form.condominioId}
                    className={estiloCampo}
                  >
                    <option value="">{form.condominioId ? "Selecione…" : "Escolha o condomínio primeiro"}</option>
                    {ucsDoCondominio.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.apelido} · UC {u.numeroUc}
                      </option>
                    ))}
                  </select>
                  {uc && (
                    <p id={`${idCampo("ucId")}-dica`} className="mt-1 text-xs text-muted">
                      Subgrupo {uc.subgrupo} · tarifa {uc.modalidade} · mercado {uc.ambiente}
                      {uc.demandaContratadaKw ? ` · demanda contratada ${formatarKw(uc.demandaContratadaKw)}` : ""}
                    </p>
                  )}
                </Campo>

                <fieldset className="sm:col-span-2" aria-describedby={erroDe("tipoFatura") ? `${idCampo("tipoFatura")}-erro` : undefined}>
                  <legend className="mb-1.5 flex items-center gap-2 text-sm font-medium text-foreground">
                    Tipo de fatura <span className="text-critical" aria-hidden>*</span>
                    {lido("tipoFatura") && <SeloLido />}
                  </legend>
                  {!uc ? (
                    <p className="text-sm text-muted">Escolha a unidade consumidora para ver as opções.</p>
                  ) : uc.ambiente === "cativo" ? (
                    <p className="rounded-lg border border-border bg-surface-2/60 px-3 py-2 text-sm text-foreground">
                      {ROTULOS_TIPO_FATURA.completa} <span className="text-muted">— esta UC compra energia da distribuidora (mercado cativo).</span>
                    </p>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 [&>*]:min-w-0" id={idCampo("tipoFatura")}>
                      {(["distribuicao", "energia_livre"] as TipoFaturaEnergia[]).map((t) => (
                        <label
                          key={t}
                          className={cn(
                            "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary",
                            form.tipoFatura === t ? "border-primary bg-primary-soft/60" : "border-border-strong hover:bg-surface-2",
                          )}
                        >
                          <input
                            type="radio"
                            name={`${prefixo}-tipo`}
                            value={t}
                            checked={form.tipoFatura === t}
                            onChange={() => alterar("tipoFatura", t)}
                            className="mt-0.5 accent-[var(--primary)]"
                          />
                          <span>
                            <span className="block font-medium text-foreground">{ROTULOS_TIPO_FATURA[t]}</span>
                            <span className="block text-xs text-muted">
                              {t === "distribuicao" ? uc.distribuidora : uc.comercializadora}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                  {erroDe("tipoFatura") && (
                    <p id={`${idCampo("tipoFatura")}-erro`} className="mt-1 text-xs font-medium text-critical">
                      {erroDe("tipoFatura")}
                    </p>
                  )}
                </fieldset>

                <Campo rotulo="Leitura anterior" obrigatorio erro={erroDe("leituraAnterior")} id={idCampo("leituraAnterior")} lido={lido("leituraAnterior")}>
                  <input
                    {...a11y("leituraAnterior")}
                    type="date"
                    value={form.leituraAnterior}
                    onChange={(e) => alterar("leituraAnterior", e.target.value)}
                    className={estiloCampo}
                  />
                </Campo>
                <Campo rotulo="Leitura atual" obrigatorio erro={erroDe("leituraAtual")} id={idCampo("leituraAtual")} lido={lido("leituraAtual")}>
                  <input
                    {...a11y("leituraAtual", true)}
                    type="date"
                    value={form.leituraAtual}
                    onChange={(e) => alterar("leituraAtual", e.target.value)}
                    className={estiloCampo}
                  />
                  <p id={`${idCampo("leituraAtual")}-dica`} className="mt-1 text-xs text-muted">
                    {dias !== undefined && dias > 0 ? `Ciclo de ${dias} dias (calculado)` : "Os dias do ciclo são calculados pelas datas"}
                  </p>
                </Campo>
                <Campo rotulo="Consumo (kWh)" obrigatorio erro={erroDe("consumoKwh")} id={idCampo("consumoKwh")} lido={lido("consumoKwh")}>
                  <input
                    {...a11y("consumoKwh", true)}
                    inputMode="numeric"
                    value={form.consumoKwh}
                    onChange={(e) => alterar("consumoKwh", e.target.value)}
                    placeholder="Ex.: 7806"
                    className={cn(estiloCampo, "tabular")}
                  />
                  <p id={`${idCampo("consumoKwh")}-dica`} className="mt-1 text-xs text-muted">
                    {kwh && dias && dias > 0 ? `${formatarKwhDia(kwh / dias)} — é o número que compara meses de tamanhos diferentes` : "Total faturado no ciclo"}
                  </p>
                </Campo>
                <Campo rotulo="Bandeira tarifária" obrigatorio erro={erroDe("bandeira")} id={idCampo("bandeira")} lido={lido("bandeira")}>
                  <select
                    {...a11y("bandeira")}
                    value={form.bandeira}
                    onChange={(e) => alterar("bandeira", e.target.value as Bandeira | "")}
                    className={estiloCampo}
                  >
                    <option value="">Selecione…</option>
                    {(Object.keys(ROTULOS_BANDEIRA) as Bandeira[]).map((b) => (
                      <option key={b} value={b}>
                        {ROTULOS_BANDEIRA[b]}
                      </option>
                    ))}
                  </select>
                </Campo>

                {uc?.subgrupo === "A4" && (
                  <>
                    <p className="text-xs font-semibold tracking-wide text-subtle uppercase sm:col-span-2">Média tensão (grupo A)</p>
                    <Campo rotulo="Demanda medida (kW)" erro={erroDe("demandaMedidaKw")} id={idCampo("demandaMedidaKw")} lido={lido("demandaMedidaKw")} dica="opcional">
                      <input
                        {...a11y("demandaMedidaKw", true)}
                        inputMode="decimal"
                        value={form.demandaMedidaKw}
                        onChange={(e) => alterar("demandaMedidaKw", e.target.value)}
                        className={cn(estiloCampo, "tabular")}
                      />
                      <p id={`${idCampo("demandaMedidaKw")}-dica`} className="mt-1 text-xs text-muted">
                        Contratada: {uc.demandaContratadaKw ? formatarKw(uc.demandaContratadaKw) : "—"}
                      </p>
                    </Campo>
                    <div className="hidden sm:block" />
                    <Campo rotulo="Consumo na ponta (kWh)" erro={erroDe("consumoPontaKwh")} id={idCampo("consumoPontaKwh")} lido={lido("consumoPontaKwh")} dica="opcional">
                      <input
                        {...a11y("consumoPontaKwh")}
                        inputMode="numeric"
                        value={form.consumoPontaKwh}
                        onChange={(e) => alterar("consumoPontaKwh", e.target.value)}
                        className={cn(estiloCampo, "tabular")}
                      />
                    </Campo>
                    <Campo rotulo="Consumo fora da ponta (kWh)" erro={erroDe("consumoForaPontaKwh")} id={idCampo("consumoForaPontaKwh")} lido={lido("consumoForaPontaKwh")} dica="opcional">
                      <input
                        {...a11y("consumoForaPontaKwh")}
                        inputMode="numeric"
                        value={form.consumoForaPontaKwh}
                        onChange={(e) => alterar("consumoForaPontaKwh", e.target.value)}
                        className={cn(estiloCampo, "tabular")}
                      />
                    </Campo>
                  </>
                )}
              </div>
              {!inicial.extraida?.energia?.itens?.length && (
                <p className="mt-4 flex items-start gap-2 text-xs text-muted">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  Sem o detalhamento dos itens, a conta é salva com um item único “Total da fatura”.
                </p>
              )}
            </Secao>
          )}

          {(form.categoria === "agua" || form.categoria === "gas") && (
            <Secao titulo={form.categoria === "agua" ? "Detalhes da água" : "Detalhes do gás"} numero={3}>
              <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
                <Campo
                  rotulo="Consumo (m³)"
                  obrigatorio={form.categoria === "agua"}
                  erro={erroDe("consumoM3")}
                  id={idCampo("consumoM3")}
                  lido={lido("consumoM3")}
                  dica={form.categoria === "gas" ? "opcional" : undefined}
                >
                  <input
                    {...a11y("consumoM3", true)}
                    inputMode="decimal"
                    value={form.consumoM3}
                    onChange={(e) => alterar("consumoM3", e.target.value)}
                    className={cn(estiloCampo, "tabular")}
                  />
                  <p id={`${idCampo("consumoM3")}-dica`} className="mt-1 text-xs text-muted">
                    {m3 && valor ? `${formatarMoeda(valor / m3)} por m³` : "Está na conta, perto do histórico de consumo"}
                  </p>
                </Campo>
                {form.categoria === "agua" && (
                  <Campo rotulo="Dias do ciclo" erro={erroDe("diasCiclo")} id={idCampo("diasCiclo")} lido={lido("diasCiclo")} dica="padrão: 30">
                    <input
                      {...a11y("diasCiclo", true)}
                      inputMode="numeric"
                      value={form.diasCiclo}
                      onChange={(e) => alterar("diasCiclo", e.target.value)}
                      placeholder="30"
                      className={cn(estiloCampo, "tabular")}
                    />
                    <p id={`${idCampo("diasCiclo")}-dica`} className="mt-1 text-xs text-muted">
                      {m3 ? `${formatarNumero1(m3 / (lerNumero(form.diasCiclo) || 30))} m³/dia — usado para detectar vazamentos` : "Usado para comparar meses de tamanhos diferentes"}
                    </p>
                  </Campo>
                )}
              </div>
            </Secao>
          )}

          <Secao titulo="Observações" numero={form.categoria === "energia" || form.categoria === "agua" || form.categoria === "gas" ? 4 : 3}>
            <label htmlFor={idCampo("observacoes")} className="sr-only">
              Observações
            </label>
            <textarea
              id={idCampo("observacoes")}
              value={form.observacoes}
              onChange={(e) => alterar("observacoes", e.target.value)}
              rows={3}
              placeholder="Opcional. Ex.: conta com multa por atraso, valor contestado…"
              className={cn(estiloCampo, "h-auto py-2")}
            />
          </Secao>
        </Card>

        {duplicadas.length > 0 && (
          <div id={`${prefixo}-duplicada`} className="rounded-xl border border-warn/40 bg-warn-soft px-4 py-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle className="size-4 text-warn" aria-hidden />
              Já existe {duplicadas.length === 1 ? "uma conta parecida" : `${duplicadas.length} contas parecidas`} para este mês
            </p>
            <ul className="mt-2 space-y-1.5">
              {duplicadas.slice(0, 3).map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted">
                  <span className="font-medium text-foreground">{d.descricao}</span>
                  <span className="tabular">· {formatarMoeda(d.valor)}</span>
                  <span>· vence {formatarData(d.vencimento)}</span>
                  <span>· {d.origem === "envio" ? "enviada por você" : "demonstração"}</span>
                  <Link href={`/contas?conta=${encodeURIComponent(d.id)}`} target="_blank" className="text-primary underline underline-offset-2">
                    ver conta
                  </Link>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2.5 font-medium text-foreground">
              <input
                type="checkbox"
                checked={confirmouDuplicada}
                onChange={(e) => setConfirmouDuplicada(e.target.checked)}
                className="size-4 accent-[var(--primary)]"
              />
              É outra conta — quero salvar mesmo assim
            </label>
          </div>
        )}

        {erroSalvar && (
          <p role="alert" className="rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
            {erroSalvar}
          </p>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variante="fantasma" onClick={aoVoltar}>
            <ArrowLeft aria-hidden />
            {arquivo ? "Voltar e trocar o arquivo" : "Voltar e enviar um arquivo"}
          </Button>
          <Button type="submit" tamanho="lg">
            <Save aria-hidden />
            {duplicadas.length > 0 && confirmouDuplicada ? "Salvar mesmo assim" : "Salvar conta"}
          </Button>
        </div>
      </div>

      {/* Prévia */}
      <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
        <Card className="p-5">
          <p className="text-xs font-semibold tracking-wide text-subtle uppercase">Como vai aparecer</p>
          {previa ? (
            <div className="mt-3">
              <div className="flex items-start gap-3">
                <IconeCategoria categoria={previa.categoria} />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{previa.descricao}</p>
                  <p className="text-xs text-muted">
                    {condominio?.nome ?? "Condomínio a definir"}
                    {previa.fornecedor ? ` · ${previa.fornecedor}` : ""}
                  </p>
                </div>
              </div>
              <p className="tabular mt-4 text-2xl font-semibold text-foreground">{formatarMoeda(previa.valor)}</p>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Mês</dt>
                  <dd className="text-foreground">{previa.competencia ? formatarCompetencia(previa.competencia) : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Vencimento</dt>
                  <dd className="text-foreground">{/^\d{4}-\d{2}-\d{2}$/.test(previa.vencimento) ? formatarData(previa.vencimento) : "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">Situação</dt>
                  <dd>{/^\d{4}-\d{2}-\d{2}$/.test(previa.vencimento) ? <StatusBadge status={statusDaConta(previa)} /> : "—"}</dd>
                </div>
                {form.categoria === "energia" && kwh ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted">Consumo</dt>
                    <dd className="tabular text-foreground">
                      {kwh.toLocaleString("pt-BR")} kWh{dias && dias > 0 ? ` · ${formatarKwhDia(kwh / dias)}` : ""}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">Escolha a categoria e informe o valor para ver a prévia.</p>
          )}
        </Card>

        {arquivo && (
          <Card className="flex items-center gap-3 p-4">
            <FileText className="size-5 shrink-0 text-subtle" aria-hidden />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{arquivo.name}</p>
              <p className="text-xs text-muted">{formatarTamanhoArquivo(arquivo.size)} · fica anexado à conta</p>
            </div>
          </Card>
        )}

        <p className="flex items-start gap-2 px-1 text-xs text-subtle">
          <Sparkles className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Assim que você salvar, a conta entra no painel, nos gráficos e nos insights.
        </p>
      </aside>
    </form>
  );
}

function Secao({ titulo, numero, icone, children }: { titulo: string; numero: number; icone?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="border-t border-border pt-5 first:border-t-0 first:pt-0 [&:not(:first-child)]:mt-6">
      <legend className="sr-only">{titulo}</legend>
      <p aria-hidden className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
        <span className="inline-flex size-5 items-center justify-center rounded-full bg-surface-2 text-[11px] text-muted">{numero}</span>
        {icone}
        {titulo}
      </p>
      {children}
    </fieldset>
  );
}

function Campo({
  rotulo,
  id,
  obrigatorio,
  erro,
  lido,
  dica,
  largo,
  children,
}: {
  rotulo: string;
  id: string;
  obrigatorio?: boolean;
  erro?: string;
  lido?: boolean;
  dica?: string;
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn(largo && "sm:col-span-2", erro && "[&_input]:border-critical [&_select]:border-critical")}>
      <label htmlFor={id} className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
        <span>
          {rotulo}
          {obrigatorio && (
            <>
              <span className="text-critical" aria-hidden>
                {" "}
                *
              </span>
              <span className="sr-only"> (obrigatório)</span>
            </>
          )}
        </span>
        {lido && <SeloLido />}
        {dica && <span className="text-xs font-normal text-muted">({dica})</span>}
      </label>
      {children}
      {erro && (
        <p id={`${id}-erro`} className="mt-1 text-xs font-medium text-critical">
          {erro}
        </p>
      )}
    </div>
  );
}
