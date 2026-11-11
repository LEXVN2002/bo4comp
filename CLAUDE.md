# BO4 Zombies Companion

Tracker pessoal de progresso de Black Ops 4 Zombies: camos, easter eggs,
desafios e sessões. Especificação completa em docs/SPEC.md: lê-a antes de
qualquer tarefa.

## Stack
- pnpm monorepo: apps/web (Vite + React 18 + TS estrito), packages/game-data,
  packages/shared, supabase/
- Tailwind (tema escuro), TanStack Query, Zod, Vitest
- Supabase: Postgres + Auth + RLS; Edge Functions só na Fase 2

## Comandos
- pnpm dev        # app web
- pnpm test       # Vitest
- pnpm seed       # valida game-data e gera supabase/seed.sql
- pnpm lint

## Regras
- Interface em português europeu (não brasileiro).
- Código real e funcional, sem mockups nem dados falsos na UI.
- Nunca inventar requisitos de camos nem passos de easter eggs: valor
  desconhecido = null + verified: false.
- RLS em todas as tabelas; nunca usar a service key no browser.
- Proibido: ler memória do jogo, injetar código, automatizar inputs,
  pedir ou guardar passwords Battle.net/Activision.
- Segredos só em .env (ignorado) ou Supabase Vault.
- Trabalhar fase a fase; não começar a Fase 2 sem a Fase 1 aceite.
- No fim de cada tarefa: correr pnpm test e pnpm lint e resumir o que mudou.
