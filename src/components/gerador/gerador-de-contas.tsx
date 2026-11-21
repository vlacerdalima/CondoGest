"use client";

import {
  CircleCheck,
  Download,
  Eye,
  FileText,
  LoaderCircle,
  Plus,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  TriangleAlert,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { estiloCampo, Rotulo } from "@/components/ui/page-header";
import { COMPETENCIA_ATUAL, COMPETENCIAS_DEMO, CONDOMINIOS, somarMeses, UNIDADES_CONSUMIDORAS } from "@/lib/dados";
import { adicionarConta, useContas } from "@/lib/dados/store";
import { formatarCompetencia, formatarCompetenciaLonga, formatarKw, formatarKwh, formatarMoeda } from "@/lib/formatacao";
import { faturaParaConta, nomeArquivoPdf } from "@/lib/gerador/conta";
import { gerarFaturas, listarFaturas } from "@/lib/gerador/fatura";
import { BANDEIRAS, ROTULO_BANDEIRA } from "@/lib/gerador/tarifas";
import type { FaturaFicticia, FaturasGeradas, ParametrosFatura, UcAvulsa } from "@/lib/gerador/tipos";
import type { Bandeira } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { PreviaPdf } from "./previa-pdf";
import { ResumoFatura } from "./resumo-fatura";

const UC_AVULSA = "avulsa";
type TipoAvulsa = "b3" | "a4_cativo" | "a4_livre";

interface Formulario {
  ucId: string;
  numeroUc: string;
  nomeCliente: string;
  tipoAvulsa: TipoAvulsa;
  demandaContratada: string;
  consumoMedio: string;
  competencia: string;
  consumo: string;
  dias: string;
  bandeira: "" | Bandeira;
  demanda: string;
}

/** Próxima competência depois da demonstração: o fluxo "gerar → enviar → painel atualiza" */
const COMPETENCIA_PADRAO = somarMeses(COMPETENCIA_ATUAL, 1);

const INICIAL: Formulario = {
  ucId: "uc-rp-bt",
  numeroUc: "8.888.000.123-4",
  nomeCliente: "Condomínio Exemplo Avulso",
  tipoAvulsa: "b3",
  demandaContratada: "100",
  consumoMedio: "",
  competencia: COMPETENCIA_PADRAO,
  consumo: "",
  dias: "",
  bandeira: "",
  demanda: "",
};

const COMPETENCIAS_FUTURAS = Array.from({ length: 13 }, (_, i) => somarMeses(COMPETENCIA_PADRAO, i));
const COMPETENCIAS_ANTERIORES = Array.from({ length: 11 }, (_, i) => somarMeses(COMPETENCIAS_DEMO[0], -(i + 1)));

/** "17.500" / "17500,5" → número; vazio ou inválido → undefined */
function lerNumero(texto: string) {
  const limpo = texto.trim().replace(/\s/g, "");
  if (!limpo) return undefined;
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo.replace(/\.(?=\d{3}(\D|$))/g, "");
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : NaN;
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function rotuloUc(ucId: string) {
  const uc = UNIDADES_CONSUMIDORAS.find((u) => u.id === ucId);
  if (!uc) return "";
  const tensao = uc.subgrupo === "A4" ? `média tensão (A4 ${uc.modalidade})` : "baixa tensão (B3)";
  const mercado = uc.ambiente === "livre" ? "mercado livre" : "mercado cativo";
  return `${tensao} · ${mercado}${uc.demandaContratadaKw ? ` · ${formatarKw(uc.demandaContratadaKw)} contratados` : ""}`;
}

function Campo({ id, rotulo, dica, erro, children }: { id: string; rotulo: string; dica?: ReactNode; erro?: string; children: ReactNode }) {
  return (
    <div>
      <Rotulo htmlFor={id} dica={dica}>
        {rotulo}
      </Rotulo>
      {children}
      {erro && (
        <p className="mt-1 text-xs text-critical" role="alert">
          {erro}
        </p>
      )}
    </div>
  );
}

export function GeradorDeContas() {
  const [form, setForm] = useState<Formulario>(INICIAL);
  const [variacao, setVariacao] = useState(0);
  const [aba, setAba] = useState<"resumo" | "pdf">("resumo");
  const [indicePdf, setIndicePdf] = useState(0);
  const [baixando, setBaixando] = useState<string | null>(null);
  const [erroDownload, setErroDownload] = useState<string | null>(null);
  const [adicionadas, setAdicionadas] = useState<{ chave: string; quantidade: number; total: number } | null>(null);
  const contas = useContas();

  const mudar = <K extends keyof Formulario>(campo: K, valor: Formulario[K]) => setForm((f) => ({ ...f, [campo]: valor }));

  const avulsa = form.ucId === UC_AVULSA;
  const ucCarteira = UNIDADES_CONSUMIDORAS.find((u) => u.id === form.ucId);
  const a4 = avulsa ? form.tipoAvulsa !== "b3" : ucCarteira?.subgrupo === "A4";
  const livre = avulsa ? form.tipoAvulsa === "a4_livre" : ucCarteira?.ambiente === "livre";

  // Validação dos campos numéricos
  const consumo = lerNumero(form.consumo);
  const demanda = lerNumero(form.demanda);
  const demandaContratada = lerNumero(form.demandaContratada);
  const consumoMedio = lerNumero(form.consumoMedio);
  const erros = {
    consumo: consumo !== undefined && !(consumo > 0 && consumo <= 2_000_000) ? "Informe um consumo entre 1 e 2.000.000 kWh." : undefined,
    demanda: a4 && demanda !== undefined && !(demanda >= 0 && demanda <= 5_000) ? "Informe uma demanda entre 0 e 5.000 kW." : undefined,
    demandaContratada:
      avulsa && a4 && demandaContratada !== undefined && !(demandaContratada >= 30 && demandaContratada <= 5_000)
        ? "Grupo A: entre 30 e 5.000 kW."
        : undefined,
    consumoMedio:
      avulsa && consumoMedio !== undefined && !(consumoMedio > 0 && consumoMedio <= 2_000_000) ? "Informe um consumo médio válido." : undefined,
    numeroUc: avulsa && !form.numeroUc.trim() ? "Informe um número (fictício) para a UC." : undefined,
  };
  const temErro = Object.values(erros).some(Boolean);
  const semente = variacao === 0 ? undefined : `variacao-${variacao}`;

  const ucParametro: string | UcAvulsa = avulsa
    ? {
        numeroUc: form.numeroUc.trim(),
        nomeCliente: form.nomeCliente,
        subgrupo: a4 ? "A4" : "B3",
        ambiente: livre ? "livre" : "cativo",
        demandaContratadaKw: a4 ? (demandaContratada ?? 100) : undefined,
        consumoMedioKwh: consumoMedio,
      }
    : form.ucId;
  const chaveUc = JSON.stringify(ucParametro);

  const parametros: ParametrosFatura | null = temErro
    ? null
    : {
        uc: ucParametro,
        competencia: form.competencia,
        consumoKwh: consumo,
        dias: form.dias ? Number(form.dias) : undefined,
        bandeira: form.bandeira || undefined,
        demandaMedidaKw: a4 ? demanda : undefined,
        semente,
      };
  const chaveParametros = JSON.stringify(parametros);

  const resultado = useMemo((): { faturas: FaturasGeradas } | { erro: string } | null => {
    if (!chaveParametros || chaveParametros === "null") return null;
    try {
      return { faturas: gerarFaturas(JSON.parse(chaveParametros) as ParametrosFatura) };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Erro ao gerar a conta" };
    }
  }, [chaveParametros]);

  // Valores automáticos (para mostrar como dica ao lado dos campos manuais)
  const automatico = useMemo(() => {
    try {
      return gerarFaturas({ uc: JSON.parse(chaveUc) as string | UcAvulsa, competencia: form.competencia, semente }, { historicoComparativo: false })
        .principal;
    } catch {
      return null;
    }
  }, [chaveUc, form.competencia, semente]);

  const faturas: FaturaFicticia[] = resultado && "faturas" in resultado ? listarFaturas(resultado.faturas) : [];
  const faturaPdf = faturas[Math.min(indicePdf, faturas.length - 1)];

  const duplicadas = avulsa
    ? []
    : faturas.filter((f) =>
        contas.some(
          (c) => c.energia?.ucId === f.uc.id && c.competencia === f.competencia && c.energia?.tipoFatura === f.tipoFatura,
        ),
      );
  const jaAdicionada = adicionadas?.chave === chaveParametros;

  async function baixar(f: FaturaFicticia) {
    setBaixando(f.tipoFatura);
    setErroDownload(null);
    try {
      const { baixarBlob, gerarBlobPdf } = await import("@/lib/gerador/pdf/navegador");
      baixarBlob(await gerarBlobPdf(f), nomeArquivoPdf(f));
    } catch (e) {
      setErroDownload(e instanceof Error ? e.message : "Erro ao gerar o PDF");
    } finally {
      setBaixando(null);
    }
  }

  function adicionarNaPlataforma() {
    if (avulsa || faturas.length === 0) return;
    for (const f of faturas) {
      adicionarConta(
        faturaParaConta(f, { observacoes: "Conta fictícia criada no gerador de contas (simulação)." }),
        nomeArquivoPdf(f),
      );
    }
    setAdicionadas({ chave: chaveParametros, quantidade: faturas.length, total: faturas.reduce((s, f) => s + f.total, 0) });
  }

  const condominioDaUc = ucCarteira && CONDOMINIOS.find((c) => c.id === ucCarteira.condominioId);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] lg:items-start">
      {/* ------------------------------ parâmetros ------------------------------ */}
      <Card>
        <CardHeader titulo="Parâmetros" descricao="Comece pela unidade consumidora; o resto pode ficar no automático." />
        <CardContent className="space-y-4">
          <Campo id="uc" rotulo="Condomínio e unidade consumidora">
            <select
              id="uc"
              className={estiloCampo}
              value={form.ucId}
              onChange={(e) => {
                mudar("ucId", e.target.value);
                setIndicePdf(0);
              }}
            >
              {CONDOMINIOS.map((c) => (
                <optgroup key={c.id} label={c.nome}>
                  {UNIDADES_CONSUMIDORAS.filter((u) => u.condominioId === c.id).map((u) => (
                    <option key={u.id} value={u.id}>
                      {c.nome} — {u.apelido.replace(/^.*— /, "")}
                    </option>
                  ))}
                </optgroup>
              ))}
              <optgroup label="Fora da carteira">
                <option value={UC_AVULSA}>UC avulsa (testar uma conta desconhecida)</option>
              </optgroup>
            </select>
            {ucCarteira && (
              <p className="mt-1.5 text-xs text-muted">
                {condominioDaUc?.nome} · {rotuloUc(ucCarteira.id)} · UC {ucCarteira.numeroUc}
              </p>
            )}
          </Campo>

          {avulsa && (
            <div className="space-y-3 rounded-lg border border-dashed border-border-strong p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo id="numero-uc" rotulo="Nº da UC (fictício)" erro={erros.numeroUc}>
                  <input id="numero-uc" className={estiloCampo} value={form.numeroUc} onChange={(e) => mudar("numeroUc", e.target.value)} />
                </Campo>
                <Campo id="cliente" rotulo="Nome do cliente">
                  <input id="cliente" className={estiloCampo} value={form.nomeCliente} onChange={(e) => mudar("nomeCliente", e.target.value)} />
                </Campo>
              </div>
              <Campo id="tipo-avulsa" rotulo="Tipo de ligação">
                <select
                  id="tipo-avulsa"
                  className={estiloCampo}
                  value={form.tipoAvulsa}
                  onChange={(e) => {
                    mudar("tipoAvulsa", e.target.value as TipoAvulsa);
                    setIndicePdf(0);
                  }}
                >
                  <option value="b3">Baixa tensão (B3) · mercado cativo</option>
                  <option value="a4_cativo">Média tensão (A4 verde) · mercado cativo</option>
                  <option value="a4_livre">Média tensão (A4 verde) · mercado livre</option>
                </select>
              </Campo>
              <div className="grid gap-3 sm:grid-cols-2">
                {a4 && (
                  <Campo id="demanda-contratada" rotulo="Demanda contratada (kW)" erro={erros.demandaContratada}>
                    <input
                      id="demanda-contratada"
                      inputMode="decimal"
                      className={estiloCampo}
                      value={form.demandaContratada}
                      onChange={(e) => mudar("demandaContratada", e.target.value)}
                    />
                  </Campo>
                )}
                <Campo id="consumo-medio" rotulo="Consumo médio (kWh/mês)" erro={erros.consumoMedio}>
                  <input
                    id="consumo-medio"
                    inputMode="decimal"
                    placeholder={a4 ? "15.000" : "6.000"}
                    className={estiloCampo}
                    value={form.consumoMedio}
                    onChange={(e) => mudar("consumoMedio", e.target.value)}
                  />
                </Campo>
              </div>
              <p className="text-xs text-muted">
                Serve para testar a tela Enviar conta com uma UC desconhecida: ela pede para escolher o condomínio.
              </p>
            </div>
          )}

          <div className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            <span className="text-muted">Tipo de fatura: </span>
            <span className="font-medium text-foreground">
              {livre
                ? "duas faturas — distribuidora (uso da rede) + comercializadora (energia)"
                : a4
                  ? "fatura completa da distribuidora (média tensão)"
                  : "fatura completa da distribuidora (baixa tensão)"}
            </span>
          </div>

          <Campo
            id="competencia"
            rotulo="Competência"
            dica={form.competencia === COMPETENCIA_PADRAO ? "próxima após a demonstração" : undefined}
          >
            <select id="competencia" className={estiloCampo} value={form.competencia} onChange={(e) => mudar("competencia", e.target.value)}>
              <optgroup label="Próximas (ainda não existem na demonstração)">
                {COMPETENCIAS_FUTURAS.map((c) => (
                  <option key={c} value={c}>
                    {capitalizar(formatarCompetenciaLonga(c))}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Meses da demonstração (a conta já existe)">
                {[...COMPETENCIAS_DEMO].reverse().map((c) => (
                  <option key={c} value={c}>
                    {capitalizar(formatarCompetenciaLonga(c))}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Anteriores">
                {COMPETENCIAS_ANTERIORES.map((c) => (
                  <option key={c} value={c}>
                    {capitalizar(formatarCompetenciaLonga(c))}
                  </option>
                ))}
              </optgroup>
            </select>
          </Campo>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Campo
              id="consumo"
              rotulo="Consumo (kWh)"
              dica={automatico ? `auto: ${formatarKwh(automatico.consumoKwh)}` : undefined}
              erro={erros.consumo}
            >
              <input
                id="consumo"
                inputMode="decimal"
                placeholder="Automático"
                className={estiloCampo}
                value={form.consumo}
                onChange={(e) => mudar("consumo", e.target.value)}
              />
            </Campo>
            <Campo id="dias" rotulo="Dias do ciclo" dica={automatico ? `auto: ${automatico.dias}` : undefined}>
              <select id="dias" className={estiloCampo} value={form.dias} onChange={(e) => mudar("dias", e.target.value)}>
                <option value="">Automático</option>
                {[28, 29, 30, 31, 32, 33].map((d) => (
                  <option key={d} value={d}>
                    {d} dias
                  </option>
                ))}
              </select>
            </Campo>
            <Campo id="bandeira" rotulo="Bandeira tarifária">
              <select
                id="bandeira"
                className={estiloCampo}
                value={form.bandeira}
                onChange={(e) => mudar("bandeira", e.target.value as Formulario["bandeira"])}
              >
                <option value="">Automática (calendário)</option>
                {BANDEIRAS.map((b) => (
                  <option key={b} value={b}>
                    {ROTULO_BANDEIRA[b]}
                  </option>
                ))}
              </select>
            </Campo>
            {a4 && (
              <Campo
                id="demanda"
                rotulo="Demanda medida (kW)"
                dica={automatico?.demandaMedidaKw !== undefined ? `auto: ${formatarKw(automatico.demandaMedidaKw)}` : undefined}
                erro={erros.demanda}
              >
                <input
                  id="demanda"
                  inputMode="decimal"
                  placeholder="Automática"
                  className={estiloCampo}
                  value={form.demanda}
                  onChange={(e) => mudar("demanda", e.target.value)}
                />
              </Campo>
            )}
          </div>
          {livre && (
            <p className="text-xs text-muted">
              No mercado livre a bandeira não entra na conta; ela só muda a estimativa de quanto custaria no mercado cativo.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button variante="contorno" onClick={() => setVariacao((v) => v + 1)}>
              <Shuffle aria-hidden />
              Gerar outra variação
            </Button>
            {(variacao > 0 || form.consumo || form.dias || form.bandeira || form.demanda) && (
              <Button
                variante="fantasma"
                onClick={() => {
                  setVariacao(0);
                  setForm((f) => ({ ...f, consumo: "", dias: "", bandeira: "", demanda: "" }));
                }}
              >
                <RotateCcw aria-hidden />
                Voltar ao padrão
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">
            {variacao === 0
              ? "Série padrão: continua o histórico da demonstração (mesmas leituras do medidor)."
              : `Variação nº ${variacao}: muda consumo, datas e itens eventuais deste mês.`}
          </p>
        </CardContent>
      </Card>

      {/* ------------------------------ prévia ------------------------------ */}
      <Card className="min-w-0">
        <CardHeader
          titulo="Prévia"
          descricao={
            faturas[0]
              ? `${formatarCompetenciaLonga(faturas[0].competencia)} · ${faturas.length === 2 ? "2 faturas" : "1 fatura"} · total ${formatarMoeda(
                  faturas.reduce((s, f) => s + f.total, 0),
                )}`
              : "Ajuste os parâmetros"
          }
          acoes={
            <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5" role="group" aria-label="Formato da prévia">
              {(
                [
                  ["resumo", "Resumo", FileText],
                  ["pdf", "PDF", Eye],
                ] as const
              ).map(([valor, rotulo, Icone]) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={aba === valor}
                  onClick={() => setAba(valor)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    aba === valor ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
                  )}
                >
                  <Icone className="size-4" aria-hidden />
                  {rotulo}
                </button>
              ))}
            </div>
          }
        />
        <CardContent className="space-y-5">
          {resultado && "erro" in resultado && (
            <p className="flex items-start gap-2 rounded-lg bg-critical-soft p-3 text-sm text-foreground">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-critical" aria-hidden />
              {resultado.erro}
            </p>
          )}
          {!resultado && <p className="text-sm text-muted">Corrija os campos destacados para ver a conta.</p>}

          {faturas.length > 0 && aba === "resumo" && (
            <div className="space-y-6 divide-y divide-border [&>*+*]:pt-6">
              {faturas.map((f) => (
                <ResumoFatura key={f.tipoFatura} fatura={f} />
              ))}
            </div>
          )}

          {faturaPdf && aba === "pdf" && (
            <div className="space-y-3">
              {faturas.length === 2 && (
                <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5" role="group" aria-label="Qual fatura">
                  {faturas.map((f, i) => (
                    <button
                      key={f.tipoFatura}
                      type="button"
                      aria-pressed={indicePdf === i}
                      onClick={() => setIndicePdf(i)}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                        indicePdf === i ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground",
                      )}
                    >
                      {f.tipoFatura === "energia_livre" ? "Comercializadora" : "Distribuidora"}
                    </button>
                  ))}
                </div>
              )}
              <PreviaPdf fatura={faturaPdf} />
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-border bg-surface-2/60 p-3 text-xs text-muted">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <p>
              O PDF sai com marca d&apos;água &quot;Documento fictício — simulação CondoGest — sem valor&quot; em todas as
              páginas, empresas e documentos fictícios e nenhum código de pagamento. Os dados da conta vão embutidos no
              arquivo para a tela Enviar conta ler automaticamente.
            </p>
          </div>
        </CardContent>

        <CardFooter className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {faturas.map((f) => (
              <Button
                key={f.tipoFatura}
                variante={f.tipoFatura === "energia_livre" ? "contorno" : "primaria"}
                disabled={baixando !== null}
                onClick={() => baixar(f)}
              >
                {baixando === f.tipoFatura ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
                {f.tipoFatura === "energia_livre"
                  ? "Baixar fatura da comercializadora"
                  : faturas.length === 2
                    ? "Baixar fatura da distribuidora"
                    : "Baixar PDF"}
              </Button>
            ))}
            <Button variante="secundaria" disabled={avulsa || faturas.length === 0 || jaAdicionada} onClick={adicionarNaPlataforma}>
              <Plus aria-hidden />
              Adicionar direto à plataforma
            </Button>
          </div>

          {erroDownload && (
            <p className="text-sm text-critical" role="alert">
              Não foi possível gerar o PDF: {erroDownload}
            </p>
          )}
          {avulsa && (
            <p className="text-xs">
              UC avulsa não entra direto na plataforma: baixe o PDF e envie pela tela Enviar conta para escolher o condomínio.
            </p>
          )}
          {!jaAdicionada && duplicadas.length > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-warn">
              <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
              Já existe conta desta UC em {formatarCompetencia(duplicadas[0].competencia)}
              {duplicadas.length < faturas.length ? " (parte do par)" : ""}. Adicionar de novo duplica o gasto no painel.
            </p>
          )}
          {jaAdicionada && adicionadas && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ok/30 bg-ok-soft p-3 text-sm text-foreground" role="status">
              <CircleCheck className="size-4 shrink-0 text-ok" aria-hidden />
              <span className="min-w-0 flex-1">
                {adicionadas.quantidade === 2
                  ? `2 contas adicionadas (${formatarMoeda(adicionadas.total)}). Elas já aparecem`
                  : `Conta adicionada (${formatarMoeda(adicionadas.total)}). Ela já aparece`}{" "}
                em Contas, no Painel e em Energia.
              </span>
              <ButtonLink href="/contas" variante="contorno" tamanho="sm">
                Ver em Contas
              </ButtonLink>
            </div>
          )}
          {faturas[0] && (
            <p className="text-xs">
              Arquivo: <span className="font-mono">{nomeArquivoPdf(faturas[0])}</span>
              {faturas[0].semente !== "demo" && (
                <Badge tom="neutro" className="ml-2">
                  variação
                </Badge>
              )}
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
