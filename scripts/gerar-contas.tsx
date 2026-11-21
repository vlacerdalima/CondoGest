/**
 * Gera contas fictícias de energia em PDF (e/ou JSON) pela linha de comando.
 *
 *   npx tsx scripts/gerar-contas.tsx --uc uc-rp-bt --de 2026-01 --ate 2026-12 --saida ./contas-geradas
 *   npx tsx scripts/gerar-contas.tsx --uc todas --de 2026-12 --json
 *   npm run gerar:contas -- --uc uc-rp-mt --de 2026-12
 *
 * Opções:
 *   --uc <id|todas>     UC da carteira (ex.: uc-rp-mt, uc-rp-bt) ou "todas". Aceita lista: uc-rp-mt,uc-rp-bt
 *   --de <AAAA-MM>      primeira competência (padrão: 2026-12)
 *   --ate <AAAA-MM>     última competência (padrão: igual a --de)
 *   --saida <pasta>     pasta de saída (padrão: ./contas-geradas)
 *   --json              também grava <saida>/contas.json com as Contas (contrato src/lib/tipos.ts)
 *   --sem-pdf           não gera PDFs (use com --json)
 *   --semente <texto>   variação (padrão: série da demonstração)
 *   --consumo <kWh>     consumo fixo em todas as competências
 *   --dias <28-33>      dias do ciclo
 *   --bandeira <b>      verde | amarela | vermelha_1 | vermelha_2 | escassez_hidrica
 *   --demanda <kW>      demanda medida (A4)
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UNIDADES_CONSUMIDORAS } from "../src/lib/dados/condominios";
import { somarMeses } from "../src/lib/dados/referencia";
import { faturaParaConta, nomeArquivoPdf } from "../src/lib/gerador/conta";
import { gerarFaturas, listarFaturas } from "../src/lib/gerador/fatura";
import { DocumentoFatura } from "../src/lib/gerador/pdf/documento";
import { prepararMotor } from "../src/lib/gerador/pdf/primitivas";
import { competenciaValida, COMPETENCIA_MAXIMA, COMPETENCIA_MINIMA } from "../src/lib/gerador/serie";
import { BANDEIRAS } from "../src/lib/gerador/tarifas";
import type { NovaContaEnergia } from "../src/lib/gerador/tipos";
import type { Bandeira } from "../src/lib/tipos";

function lerArgumentos(argv: string[]) {
  const opcoes: Record<string, string | true> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [chave, valorInline] = arg.slice(2).split("=", 2);
    if (valorInline !== undefined) opcoes[chave] = valorInline;
    else if (argv[i + 1] && !argv[i + 1].startsWith("--")) opcoes[chave] = argv[++i];
    else opcoes[chave] = true;
  }
  return opcoes;
}

function falhar(msg: string): never {
  console.error(`Erro: ${msg}\nUse --ajuda para ver as opções.`);
  process.exit(1);
}

const texto = (v: string | true | undefined) => (typeof v === "string" ? v : undefined);
function numero(v: string | true | undefined, nome: string) {
  const t = texto(v);
  if (t === undefined) return undefined;
  const n = Number(t.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) falhar(`--${nome} precisa ser um número positivo`);
  return n;
}

async function main() {
  const op = lerArgumentos(process.argv.slice(2));
  if (op.ajuda || op.help || op.h) {
    const fonte = await import("node:fs").then((fs) => fs.readFileSync(__filename, "utf8"));
    console.log(fonte.slice(fonte.indexOf("/**") + 3, fonte.indexOf("*/")).replace(/^ \* ?/gm, ""));
    return;
  }

  const ucArg = texto(op.uc) ?? "todas";
  const ucs = ucArg === "todas" ? UNIDADES_CONSUMIDORAS.map((u) => u.id) : ucArg.split(",").map((s) => s.trim());
  for (const id of ucs) {
    if (!UNIDADES_CONSUMIDORAS.some((u) => u.id === id)) {
      falhar(`UC "${id}" não existe. Opções: ${UNIDADES_CONSUMIDORAS.map((u) => u.id).join(", ")}, todas`);
    }
  }
  const de = texto(op.de) ?? "2026-12";
  const ate = texto(op.ate) ?? de;
  for (const c of [de, ate]) {
    if (!competenciaValida(c)) falhar(`competência "${c}" inválida (use AAAA-MM entre ${COMPETENCIA_MINIMA} e ${COMPETENCIA_MAXIMA})`);
  }
  if (ate < de) falhar("--ate precisa ser igual ou posterior a --de");
  const bandeira = texto(op.bandeira) as Bandeira | undefined;
  if (bandeira && !BANDEIRAS.includes(bandeira)) falhar(`bandeira inválida. Opções: ${BANDEIRAS.join(", ")}`);
  const dias = numero(op.dias, "dias");
  if (dias !== undefined && (dias < 28 || dias > 33)) falhar("--dias precisa estar entre 28 e 33");

  const saida = path.resolve(texto(op.saida) ?? "./contas-geradas");
  const gerarPdf = !op["sem-pdf"];
  await mkdir(saida, { recursive: true });
  // O motor do react-pdf é ESM-only: import() dinâmico (o tsx roda este script como CommonJS)
  const motor = gerarPdf ? await import("@react-pdf/renderer") : null;
  if (motor) prepararMotor(motor);

  const competencias: string[] = [];
  for (let c = de; c <= ate; c = somarMeses(c, 1)) competencias.push(c);

  const contas: (NovaContaEnergia & { numeroUc: string; arquivo?: string })[] = [];
  const inicio = Date.now();
  for (const uc of ucs) {
    for (const competencia of competencias) {
      const faturas = listarFaturas(
        gerarFaturas({
          uc,
          competencia,
          semente: texto(op.semente),
          consumoKwh: numero(op.consumo, "consumo"),
          dias,
          bandeira,
          demandaMedidaKw: numero(op.demanda, "demanda"),
        }),
      );
      for (const fatura of faturas) {
        const arquivo = nomeArquivoPdf(fatura);
        if (motor) await motor.renderToFile(<DocumentoFatura fatura={fatura} />, path.join(saida, arquivo));
        contas.push({ ...faturaParaConta(fatura, { arquivoNome: arquivo }), numeroUc: fatura.uc.numeroUc, arquivo });
        console.log(
          `${motor ? "✓" : "·"} ${arquivo.padEnd(58)} ${fatura.tipoFatura.padEnd(13)} ${String(Math.round(fatura.consumoKwh)).padStart(7)} kWh  R$ ${fatura.total.toFixed(2).padStart(10)}  venc. ${fatura.vencimento}`,
        );
      }
    }
  }
  if (op.json) {
    const destino = path.join(saida, "contas.json");
    await writeFile(destino, JSON.stringify(contas, null, 2), "utf8");
    console.log(`JSON: ${destino}`);
  }
  console.log(`${contas.length} conta(s) em ${saida} (${((Date.now() - inicio) / 1000).toFixed(1)} s)`);
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
