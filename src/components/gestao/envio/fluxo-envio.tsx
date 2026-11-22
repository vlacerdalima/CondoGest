"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  CloudUpload,
  FileQuestion,
  FileText,
  FlaskConical,
  ImageIcon,
  LayoutDashboard,
  LoaderCircle,
  PencilLine,
  ReceiptText,
  RotateCcw,
  ScanText,
  ShieldCheck,
  X,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { obterCondominio, statusDaConta } from "@/lib/dados";
import { adicionarConta, type NovaConta } from "@/lib/dados/store";
import { formatarCompetencia, formatarData, formatarMoeda, ROTULOS_CATEGORIA } from "@/lib/formatacao";
import { extrairDadosDaConta } from "@/lib/gerador/extracao";
import type { Conta, ResultadoExtracao } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { IconeCategoria } from "../categoria";
import { formatarTamanhoArquivo } from "../formato";
import { ROTULOS_TIPO_FATURA } from "../rotulos";
import { ContasEnviadas } from "./contas-enviadas";
import { FormularioRevisao, type DadosIniciaisRevisao } from "./formulario-revisao";
import { FORMULARIO_VAZIO, formularioDaExtracao } from "./modelo";

type Etapa = "arquivo" | "leitura" | "revisao" | "sucesso";

const LIMITE_BYTES = 10 * 1024 * 1024;
const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"];
const EXTENSOES_ACEITAS = /\.(pdf|jpe?g|png)$/i;
/** Tempo mínimo do "lendo…" para a leitura não piscar na tela */
const LEITURA_MINIMA_MS = 900;

function validarArquivo(arquivo: File): string | null {
  if (!TIPOS_ACEITOS.includes(arquivo.type) && !EXTENSOES_ACEITAS.test(arquivo.name)) {
    return `"${arquivo.name}" não é um formato aceito. Envie um PDF, JPG ou PNG.`;
  }
  if (arquivo.size === 0) return `"${arquivo.name}" está vazio.`;
  if (arquivo.size > LIMITE_BYTES) {
    return `"${arquivo.name}" tem ${formatarTamanhoArquivo(arquivo.size)}. O limite é 10 MB — tente exportar o PDF de novo ou tirar uma foto menor.`;
  }
  return null;
}

/* ------------------------------ etapas ------------------------------ */

const ETAPAS: { id: Etapa; rotulo: string }[] = [
  { id: "arquivo", rotulo: "Arquivo" },
  { id: "leitura", rotulo: "Leitura automática" },
  { id: "revisao", rotulo: "Revisão" },
  { id: "sucesso", rotulo: "Confirmação" },
];

function Etapas({ atual, semArquivo }: { atual: Etapa; semArquivo: boolean }) {
  const indiceAtual = ETAPAS.findIndex((e) => e.id === atual);
  return (
    <nav aria-label="Etapas do envio">
      <ol className="grid grid-cols-4 gap-2">
        {ETAPAS.map((e, i) => {
          const pulada = semArquivo && i <= 1 && indiceAtual > 1;
          const concluida = i < indiceAtual || atual === "sucesso";
          const ehAtual = i === indiceAtual && atual !== "sucesso";
          return (
            <li key={e.id} aria-current={ehAtual ? "step" : undefined} className="min-w-0">
              <div
                className={cn(
                  "h-1 rounded-full transition-colors",
                  concluida || ehAtual ? "bg-primary" : "bg-border",
                  pulada && "bg-border-strong",
                )}
              />
              <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm">
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                    concluida && !pulada && "bg-primary text-primary-foreground",
                    ehAtual && "bg-primary-soft text-primary ring-1 ring-primary",
                    !concluida && !ehAtual && "bg-surface-2 text-muted",
                    pulada && "bg-surface-2 text-subtle",
                  )}
                  aria-hidden
                >
                  {concluida && !pulada ? <Check className="size-3" /> : i + 1}
                </span>
                <span className={cn("truncate", ehAtual ? "font-semibold text-foreground" : "text-muted")}>
                  {e.rotulo}
                  {pulada && <span className="hidden sm:inline"> (pulada)</span>}
                </span>
                <span className="sr-only">
                  {pulada ? " — etapa pulada" : concluida ? " — concluída" : ehAtual ? " — etapa atual" : " — pendente"}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function CartaoArquivo({ arquivo, previa, aoRemover }: { arquivo: File; previa: string | null; aoRemover?: () => void }) {
  const ehPdf = arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface-2/50 p-3">
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-surface">
        {previa ? (
          // Prévia local (blob:) — next/image não se aplica aqui
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previa} alt={`Prévia de ${arquivo.name}`} className="size-full object-cover" />
        ) : ehPdf ? (
          <span className="flex flex-col items-center text-critical">
            <FileText className="size-6" aria-hidden />
            <span className="text-[10px] font-bold">PDF</span>
          </span>
        ) : (
          <ImageIcon className="size-6 text-subtle" aria-hidden />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{arquivo.name}</p>
        <p className="text-xs text-muted">
          {ehPdf ? "PDF" : "Imagem"} · {formatarTamanhoArquivo(arquivo.size)}
        </p>
      </div>
      {aoRemover && (
        <Button variante="fantasma" tamanho="sm" onClick={aoRemover}>
          <X aria-hidden />
          Trocar
        </Button>
      )}
    </div>
  );
}

function EtapaArquivo({
  erro,
  aoEscolher,
  aoPreencherManual,
}: {
  erro: string | null;
  aoEscolher: (arquivos: FileList | File[]) => void;
  aoPreencherManual: () => void;
}) {
  const idInput = useId();
  const [arrastando, setArrastando] = useState(false);
  const contador = useRef(0);

  const aoSoltar = (e: DragEvent) => {
    e.preventDefault();
    contador.current = 0;
    setArrastando(false);
    if (e.dataTransfer.files.length) aoEscolher(e.dataTransfer.files);
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Envie o arquivo da conta</h2>
      <p className="mt-1 text-sm text-muted">PDF da fatura ou foto legível da conta. O CondoGest tenta ler os dados para você.</p>

      <label
        htmlFor={idInput}
        onDragEnter={(e) => {
          e.preventDefault();
          contador.current++;
          setArrastando(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={() => {
          contador.current--;
          if (contador.current <= 0) setArrastando(false);
        }}
        onDrop={aoSoltar}
        className={cn(
          "mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors",
          "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
          arrastando ? "border-primary bg-primary-soft" : "border-border-strong bg-surface-2/40 hover:border-primary/60 hover:bg-primary-soft/40",
          erro && !arrastando && "border-critical/60",
        )}
      >
        <span
          className={cn(
            "inline-flex size-14 items-center justify-center rounded-2xl transition-colors",
            arrastando ? "bg-primary text-primary-foreground" : "bg-primary-soft text-primary",
          )}
        >
          <CloudUpload className="size-7" aria-hidden />
        </span>
        <span className="mt-4 text-base font-semibold text-foreground">
          {arrastando ? "Solte o arquivo para enviar" : "Arraste a conta para cá"}
        </span>
        <span className="mt-1 text-sm text-muted">ou</span>
        <span className="mt-2 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
          Escolher arquivo
        </span>
        <span className="mt-3 text-xs text-subtle">PDF, JPG ou PNG · até 10 MB · uma conta por vez</span>
        <input
          id={idInput}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="sr-only"
          aria-describedby={erro ? `${idInput}-erro` : undefined}
          onChange={(e) => {
            if (e.target.files?.length) aoEscolher(e.target.files);
            e.target.value = "";
          }}
        />
      </label>

      {erro && (
        <p id={`${idInput}-erro`} role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-critical-soft px-3 py-2 text-sm text-critical">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {erro}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-sm text-muted">Não tem o arquivo à mão?</p>
        <Button variante="contorno" onClick={aoPreencherManual}>
          <PencilLine aria-hidden />
          Preencher sem arquivo
        </Button>
      </div>
    </div>
  );
}

function EtapaLeitura({
  aviso,
  arquivo,
  previa,
  lendo,
  resultado,
  aoContinuar,
  aoTrocar,
}: {
  aviso: string | null;
  arquivo: File;
  previa: string | null;
  lendo: boolean;
  resultado: ResultadoExtracao | null;
  aoContinuar: () => void;
  aoTrocar: () => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-foreground">Leitura automática</h2>
      <p className="mt-1 text-sm text-muted">Procurando no arquivo os dados da conta: condomínio, valor, vencimento, consumo…</p>
      <div className="mt-5">
        <CartaoArquivo arquivo={arquivo} previa={previa} aoRemover={lendo ? undefined : aoTrocar} />
      </div>
      {aviso && (
        <p className="mt-3 flex items-start gap-2 text-sm text-muted">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
          {aviso}
        </p>
      )}

      <div aria-live="polite" className="mt-5">
        {lendo || !resultado ? (
          <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-5">
            <LoaderCircle className="size-6 shrink-0 animate-spin text-primary" aria-hidden />
            <div>
              <p className="font-medium text-foreground">Lendo a conta…</p>
              <p className="text-sm text-muted">Isso leva só alguns segundos.</p>
            </div>
          </div>
        ) : resultado.status === "reconhecido" ? (
          <ResultadoReconhecido resultado={resultado} aoContinuar={aoContinuar} />
        ) : resultado.status === "parcial" ? (
          <div className="rounded-xl border border-warn/40 bg-warn-soft p-5">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <AlertTriangle className="size-5 text-warn" aria-hidden />
              Lemos parte dos dados
            </p>
            <p className="mt-1 text-sm text-muted">{resultado.aviso}</p>
            <p className="mt-1 text-xs text-subtle">Fonte: {resultado.fonte}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={aoContinuar}>
                Completar os dados
                <ArrowRight aria-hidden />
              </Button>
              <Button variante="contorno" onClick={aoTrocar}>
                Tentar outro arquivo
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-2/50 p-5">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              <FileQuestion className="size-5 text-muted" aria-hidden />
              Não conseguimos ler esta conta automaticamente
            </p>
            <p className="mt-1 text-sm text-muted">{resultado.motivo}</p>
            <p className="mt-1 text-sm text-muted">Sem problema: você preenche os dados e o arquivo fica anexado à conta.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button onClick={aoContinuar}>
                <PencilLine aria-hidden />
                Preencher manualmente
              </Button>
              <Button variante="contorno" onClick={aoTrocar}>
                Tentar outro arquivo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultadoReconhecido({
  resultado,
  aoContinuar,
}: {
  resultado: Extract<ResultadoExtracao, { status: "reconhecido" }>;
  aoContinuar: () => void;
}) {
  const c = resultado.conta;
  const condominio = obterCondominio(c.condominioId);
  const itens = [
    { rotulo: "Condomínio", valor: condominio?.nome ?? "—" },
    { rotulo: "Categoria", valor: ROTULOS_CATEGORIA[c.categoria] },
    { rotulo: "Fornecedor", valor: c.fornecedor },
    { rotulo: "Mês", valor: formatarCompetencia(c.competencia) },
    { rotulo: "Vencimento", valor: formatarData(c.vencimento) },
    { rotulo: "Valor", valor: formatarMoeda(c.valor) },
    ...(c.energia
      ? [
          { rotulo: "Tipo de fatura", valor: ROTULOS_TIPO_FATURA[c.energia.tipoFatura] },
          { rotulo: "Consumo", valor: `${c.energia.consumoKwh.toLocaleString("pt-BR")} kWh em ${c.energia.dias} dias` },
        ]
      : []),
  ];
  return (
    <div className="rounded-xl border border-ok/30 bg-ok-soft p-5">
      <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
        <CheckCircle2 className="size-5 text-ok" aria-hidden />
        Conta reconhecida
        <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-primary">
          <ScanText className="size-3.5" aria-hidden />
          lido automaticamente
        </span>
      </p>
      <p className="mt-1 text-xs text-muted">Fonte: {resultado.fonte}</p>
      <dl className="mt-4 grid gap-x-6 gap-y-3 rounded-lg bg-surface p-4 sm:grid-cols-2">
        {itens.map((i) => (
          <div key={i.rotulo}>
            <dt className="text-xs text-muted">{i.rotulo}</dt>
            <dd className="text-sm font-medium text-foreground">{i.valor}</dd>
          </div>
        ))}
      </dl>
      <Button onClick={aoContinuar} className="mt-4">
        Revisar e confirmar
        <ArrowRight aria-hidden />
      </Button>
    </div>
  );
}

function EtapaSucesso({ conta, aoEnviarOutra }: { conta: Conta; aoEnviarOutra: () => void }) {
  const condominio = obterCondominio(conta.condominioId);
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => titulo.current?.focus(), []);
  return (
    <div className="text-center">
      <span className="inline-flex size-14 items-center justify-center rounded-full bg-ok-soft text-ok">
        <CheckCircle2 className="size-8" aria-hidden />
      </span>
      <h2 ref={titulo} tabIndex={-1} className="mt-4 text-xl font-semibold text-foreground focus:outline-none">
        Conta enviada!
      </h2>
      <p className="mt-1 text-sm text-muted">Ela já aparece no painel, na lista de contas e nas análises.</p>

      <div className="mx-auto mt-6 max-w-md rounded-xl border border-border p-4 text-left">
        <div className="flex items-start gap-3">
          <IconeCategoria categoria={conta.categoria} />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{conta.descricao}</p>
            <p className="text-xs text-muted">
              {condominio?.nome} · {conta.fornecedor}
            </p>
          </div>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Valor</dt>
            <dd className="tabular font-semibold text-foreground">{formatarMoeda(conta.valor)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Mês</dt>
            <dd className="text-foreground">{formatarCompetencia(conta.competencia)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Vencimento</dt>
            <dd className="text-foreground">{formatarData(conta.vencimento)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Situação</dt>
            <dd>
              <StatusBadge status={statusDaConta(conta)} />
            </dd>
          </div>
        </dl>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <ButtonLink href="/painel" variante="contorno">
          <LayoutDashboard aria-hidden />
          Ver no painel
        </ButtonLink>
        <ButtonLink href={`/contas?conta=${encodeURIComponent(conta.id)}`} variante="contorno">
          <ReceiptText aria-hidden />
          Ver na lista de contas
        </ButtonLink>
        {conta.categoria === "energia" && condominio && (
          <ButtonLink href={`/energia/${condominio.slug}`} variante="energia">
            <Zap aria-hidden />
            Ver análise de energia do condomínio
          </ButtonLink>
        )}
        <Button onClick={aoEnviarOutra}>
          <RotateCcw aria-hidden />
          Enviar outra conta
        </Button>
      </div>
    </div>
  );
}

function Dicas() {
  return (
    <aside className="space-y-4">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-foreground">Como funciona</h2>
        <ol className="mt-3 space-y-3 text-sm text-muted">
          {[
            ["Envie o arquivo", "PDF ou foto da conta, até 10 MB."],
            ["Leitura automática", "O CondoGest identifica condomínio, valor, datas e consumo."],
            ["Revise", "Confira e ajuste os campos. Nada é salvo sem a sua confirmação."],
            ["Pronto", "A conta entra no painel e nas análises na hora."],
          ].map(([titulo, texto], i) => (
            <li key={titulo} className="flex gap-3">
              <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span>
                <span className="block font-medium text-foreground">{titulo}</span>
                {texto}
              </span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="border-energy-strong/50 bg-energy-soft/40 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <FlaskConical className="size-4 text-energy" aria-hidden />
          Quer testar?
        </h2>
        <p className="mt-1 text-sm text-muted">
          Gere uma conta de energia fictícia no Gerador, baixe o PDF e envie aqui: ela é lida automaticamente.
        </p>
        <Link
          href="/ferramentas/gerador-de-contas"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Abrir o Gerador de contas
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Card>

      <p className="flex items-start gap-2 px-1 text-xs text-subtle">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        MVP: as contas enviadas ficam salvas neste navegador.
      </p>
    </aside>
  );
}

/* ------------------------------ fluxo ------------------------------ */

export function FluxoEnvio() {
  const params = useSearchParams();
  const condominioDaUrl = obterCondominio(params.get("condominio") ?? "")?.id ?? "";

  const [etapa, setEtapa] = useState<Etapa>("arquivo");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [erroArquivo, setErroArquivo] = useState<string | null>(null);
  const [avisoArquivo, setAvisoArquivo] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  const [resultado, setResultado] = useState<ResultadoExtracao | null>(null);
  const [inicial, setInicial] = useState<DadosIniciaisRevisao | null>(null);
  const [salva, setSalva] = useState<Conta | null>(null);
  const [versaoForm, setVersaoForm] = useState(0);
  const leituraAtual = useRef(0);
  const topo = useRef<HTMLDivElement>(null);

  // Libera a URL da miniatura quando ela deixa de ser usada
  useEffect(() => {
    return () => {
      if (previa) URL.revokeObjectURL(previa);
    };
  }, [previa]);

  const rolarParaTopo = () => topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  async function ler(arq: File) {
    const id = ++leituraAtual.current;
    setEtapa("leitura");
    setLendo(true);
    setResultado(null);
    const inicio = performance.now();
    let r: ResultadoExtracao;
    try {
      r = await extrairDadosDaConta(arq);
    } catch {
      r = { status: "nao_reconhecido", motivo: `Não foi possível abrir "${arq.name}".` };
    }
    const decorrido = performance.now() - inicio;
    if (decorrido < LEITURA_MINIMA_MS) await new Promise((ok) => setTimeout(ok, LEITURA_MINIMA_MS - decorrido));
    if (id !== leituraAtual.current) return; // o gestor trocou de arquivo no meio
    setResultado(r);
    setLendo(false);
  }

  function escolher(arquivos: FileList | File[]) {
    const lista = Array.from(arquivos);
    const arq = lista[0];
    if (!arq) return;
    const erro = validarArquivo(arq);
    if (erro) {
      setErroArquivo(erro);
      return;
    }
    setErroArquivo(null);
    setAvisoArquivo(lista.length > 1 ? `Você soltou ${lista.length} arquivos; vamos ler só "${arq.name}". Envie uma conta por vez.` : null);
    setArquivo(arq);
    setPrevia(arq.type.startsWith("image/") ? URL.createObjectURL(arq) : null);
    void ler(arq);
  }

  function irParaRevisao(semArquivo = false) {
    let dados: DadosIniciaisRevisao;
    if (!semArquivo && resultado?.status === "reconhecido") {
      const { form, lidos } = formularioDaExtracao(resultado.conta);
      dados = { form, lidos, extraida: resultado.conta, origem: "reconhecido", fonte: resultado.fonte };
    } else if (!semArquivo && resultado?.status === "parcial") {
      const { form, lidos } = formularioDaExtracao(resultado.campos);
      dados = { form, lidos, extraida: resultado.campos, origem: "parcial", fonte: resultado.fonte, aviso: resultado.aviso };
    } else {
      dados = { form: { ...FORMULARIO_VAZIO }, lidos: new Set(), origem: "manual" };
    }
    if (!dados.form.condominioId && condominioDaUrl) dados.form.condominioId = condominioDaUrl;
    if (semArquivo) {
      leituraAtual.current++;
      setArquivo(null);
      setPrevia(null);
      setResultado(null);
    }
    setInicial(dados);
    setVersaoForm((v) => v + 1);
    setEtapa("revisao");
    rolarParaTopo();
  }

  function recomecar() {
    leituraAtual.current++;
    setArquivo(null);
    setPrevia(null);
    setResultado(null);
    setLendo(false);
    setInicial(null);
    setSalva(null);
    setErroArquivo(null);
    setAvisoArquivo(null);
    setEtapa("arquivo");
    rolarParaTopo();
  }

  function salvar(nova: NovaConta) {
    const conta = adicionarConta(nova, arquivo?.name);
    setSalva(conta);
    setEtapa("sucesso");
    rolarParaTopo();
  }

  return (
    <div className="space-y-6">
      <div ref={topo} className="scroll-mt-20">
        <PageHeader
          className="pb-0"
          titulo="Enviar conta"
          descricao="Envie a conta de qualquer fornecedor — energia, água, gás, manutenção, folha… Ela entra no painel e nas análises assim que você confirmar os dados."
        />
      </div>

      <Etapas atual={etapa} semArquivo={!arquivo && (etapa === "revisao" || etapa === "sucesso")} />

      {etapa === "revisao" && inicial ? (
        <FormularioRevisao
          key={versaoForm}
          inicial={inicial}
          arquivo={arquivo}
          aoSalvar={salvar}
          aoVoltar={recomecar}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-3 [&>*]:min-w-0">
          <Card className="p-5 sm:p-6 lg:col-span-2">
            {etapa === "arquivo" && (
              <EtapaArquivo erro={erroArquivo} aoEscolher={escolher} aoPreencherManual={() => irParaRevisao(true)} />
            )}
            {etapa === "leitura" && arquivo && (
              <EtapaLeitura
                aviso={avisoArquivo}
                arquivo={arquivo}
                previa={previa}
                lendo={lendo}
                resultado={resultado}
                aoContinuar={() => irParaRevisao()}
                aoTrocar={recomecar}
              />
            )}
            {etapa === "sucesso" && salva && <EtapaSucesso conta={salva} aoEnviarOutra={recomecar} />}
          </Card>
          <Dicas />
        </div>
      )}

      <ContasEnviadas />
    </div>
  );
}
