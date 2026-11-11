# BO4 Zombies Companion

Tracker pessoal de progresso de Black Ops 4 Zombies. Especificação em [docs/SPEC.md](docs/SPEC.md).

## Requisitos

- Node 24 (ver `.nvmrc`) e pnpm
- Docker Desktop (para o Supabase local). As portas estão na gama 554xx (API em `http://127.0.0.1:55421`, Studio em `http://127.0.0.1:55423`) para não colidir com outros projetos Supabase locais.

## Arranque

```sh
pnpm install
pnpm db:start                 # Supabase local (Docker); mostra API URL e anon key
cp apps/web/.env.example apps/web/.env.local   # preencher com os valores acima
pnpm db:reset                 # aplica migrações + supabase/seed.sql
pnpm dev                      # app web em http://localhost:5173
```

## Comandos

| Comando        | O que faz                                                       |
| -------------- | --------------------------------------------------------------- |
| `pnpm dev`     | App web (Vite)                                                  |
| `pnpm test`    | Testes unitários (Vitest)                                       |
| `pnpm lint`    | ESLint + typecheck de todos os pacotes                          |
| `pnpm seed`    | Valida `packages/game-data` com Zod e gera `supabase/seed.sql`  |
| `pnpm build`   | Valida game-data e faz build da app                             |
| `pnpm db:test` | Testes pgTAP de RLS e de `record_session` (`supabase/tests`)    |

## Dados do jogo

Os JSON em `packages/game-data` são a fonte de verdade do catálogo. Depois de os editar,
correr `pnpm seed` e `pnpm db:reset`. Requisitos desconhecidos ficam `null` com
`verified: false` (`requirement_type: "unknown"` quando nem o tipo é conhecido).
O id de cada passo de easter egg é `<easter-egg-id>-<ordem>`: reordenar passos muda os ids,
e passos removidos do JSON são apagados (com o progresso respetivo) no próximo seed.
