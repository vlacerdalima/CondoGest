# CondoGest

Plataforma de gestão de condomínios para **administradoras**, geral mas com **foco em energia** — o maior custo variável das áreas comuns. MVP do projeto de empreendedorismo (Quest9).

**Produção:** https://condogest-lime.vercel.app (deploy automático a cada push na `main`)

> Todos os dados exibidos são **fictícios**. Não há banco de dados neste MVP (ver [Arquitetura](#arquitetura)).

## O que o MVP faz

| Tela | Rota | Para quê |
|---|---|---|
| Início | `/` | Apresentação e entrada na demonstração |
| Painel | `/painel` | Visão da carteira: gastos, vencimentos, principais insights |
| Energia | `/energia`, `/energia/[condomínio]` | O diferencial: kWh/dia, demanda, ponta, mercado livre, recomendações com economia em faixa, antes/depois |
| Fala de assembleia | `/energia/[condomínio]/assembleia` | Roteiro de 3 minutos + 1 slide para o síndico (imprimível) |
| Condomínios | `/condominios`, `/condominios/[condomínio]` | Detalhe de cada condomínio da carteira |
| Contas | `/contas` | Todas as contas, filtros, marcar como paga |
| Enviar conta | `/contas/enviar` | Upload da conta (PDF/foto) → leitura automática → revisão → salvar |
| Insights | `/insights` | Todos os alertas e oportunidades |
| Gerador de contas | `/ferramentas/gerador-de-contas` | Cria contas de energia fictícias (PDF) para simular contas reais |

### Fluxo para demonstrar

1. Abra o **Gerador de contas**, gere a conta de dez/2026 de um condomínio e baixe o PDF.
2. Vá em **Enviar conta** e arraste o PDF: os dados são lidos automaticamente.
3. Confira e salve. O **Painel** e a tela de **Energia** já mostram a conta nova.

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de produção (o mesmo que a Vercel roda)
npm run lint
```

Gerar contas fictícias em lote pela linha de comando:

```bash
npm run gerar:contas -- --uc uc-rp-bt --de 2026-01 --ate 2026-12 --saida ./contas-geradas
```

## Arquitetura

- **Next.js 16** (App Router, Cache Components, Turbopack), React 19, TypeScript, Tailwind CSS 4, Recharts, @react-pdf/renderer + pdf-lib.
- **Monolito**: front e "back" no mesmo app. Sem banco por enquanto:
  - **Dados de demonstração** são gerados de forma **determinística** (PRNG com semente) a partir de uma carteira fictícia (`src/lib/dados/condominios.ts`) — iguais no servidor e no navegador.
  - **Contas enviadas** pelo gestor e pagamentos registrados ficam no **navegador** (`localStorage`), via `src/lib/dados/store.ts`.
  - "Hoje" da demonstração é fixo em `DATA_REFERENCIA` (`src/lib/dados/referencia.ts`).
- **Contrato de dados** em `src/lib/tipos.ts`. Quando entrar um banco (ex. Postgres/Supabase), esses tipos viram o schema e só a camada `src/lib/dados` muda.

```
src/
  app/                 rotas (pt-BR); (app)/ = área logada com navegação
  components/
    ui/                componentes base (Card, Button, Badge, Stat, PageHeader)
    gestao/            painel, contas, envio, condomínios
    energia/           tela de energia
    gerador/           gerador de contas fictícias
  lib/
    tipos.ts           contrato de dados
    dados/             carteira fictícia, seeds, store do navegador
    analise/           insights e recomendações (funções puras)
    gerador/           gerador de faturas fictícias, PDF e extração
scripts/               CLI do gerador
```

### Privacidade

A pasta `midia/` (contas reais do condomínio piloto, apresentação, logo) **não vai para o git** — o repositório é público. Nenhum dado real (número de UC, medidor, CNPJ, empresas) é usado no código. Todo PDF gerado leva marca d'água "DOCUMENTO FICTÍCIO — SIMULAÇÃO".

## Próximos passos sugeridos

- Banco de dados + autenticação (multi-administradora).
- Leitura automática de contas reais (PDF/foto) com IA.
- Importar o histórico de 13 meses impresso nas faturas reais do piloto.
