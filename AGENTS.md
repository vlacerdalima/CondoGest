<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## CondoGest — notas para quem for desenvolver (pessoas ou agentes)

- Produto em **português do Brasil** (UI, rotas e identificadores no código). Linguagem simples, sem jargão.
- **Sem banco de dados** no MVP: dados demo determinísticos (`src/lib/dados`, PRNG `src/lib/prng.ts`, "hoje" fixo em `DATA_REFERENCIA`) + contas enviadas no `localStorage` (`src/lib/dados/store.ts`). Telas usam `useContas()`.
- Nunca use `Math.random()`/`Date.now()`/`new Date()` no render (Cache Components quebra o prerender e a hidratação). Em event handlers pode.
- Contrato de dados: `src/lib/tipos.ts`. UCs no mercado livre têm 2 contas por mês (`tipoFatura` "distribuicao" + "energia_livre"): some R$ das duas, conte kWh uma vez só.
- Cores: use os tokens de `src/app/globals.css` (claro/escuro). Gráficos: `var(--chart-1..7)` em ordem fixa (paleta validada para daltonismo); status (ok/warn/serious/critical) nunca como cor de série; nunca eixo duplo.
- `midia/` tem contas REAIS e fica fora do git (repo público). Nunca copie dados de lá; só dados fictícios.
- Deploy: push na `main` → Vercel (condogest-lime.vercel.app). Rode `npm run build` antes de subir.
