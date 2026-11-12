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
| `pnpm db:test` | Testes pgTAP (RLS, sessões, export/import) em `supabase/tests`  |
| `pnpm db:types`| Gera `apps/web/src/lib/database.types.ts` a partir da BD local  |

## Dados do jogo

Os JSON em `packages/game-data` são a fonte de verdade do catálogo. Depois de os editar,
correr `pnpm seed` e `pnpm db:reset`. Requisitos desconhecidos ficam `null` com
`verified: false` (`requirement_type: "unknown"` quando nem o tipo é conhecido).
O id de cada passo de easter egg é `<easter-egg-id>-<ordem>`: reordenar passos muda os ids,
e passos removidos do JSON são apagados (com o progresso respetivo) no próximo seed.

## Deploy (Supabase cloud + Netlify)

Uso pessoal: a app não é um serviço público (ver "Regras e limites" na spec).

### 1. Supabase cloud

1. Criar um projeto em <https://supabase.com/dashboard> (região perto de ti, ex.: `eu-west`).
2. Ligar o projeto local e aplicar migrações + catálogo:

   ```sh
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <project-ref>
   pnpm exec supabase db push --include-seed
   ```

   Para atualizar o catálogo mais tarde: `pnpm seed`, `pnpm exec supabase db push --remote`
   (migrações novas) e depois correr o seed à mão (é idempotente):

   ```sh
   pnpm exec supabase db query --remote -f supabase/seed.sql
   ```

   Atenção: quando o seed já foi aplicado uma vez, `db push --include-seed` só atualiza o hash
   do ficheiro ("Updating seed hash") e **não** volta a executá-lo.
3. Em **Authentication → URL Configuration**: *Site URL* = URL do Netlify
   (ex.: `https://<site>.netlify.app`) e acrescentar o mesmo URL às *Redirect URLs*.
4. Em **Authentication → Providers → Email**: deixar só o login por email (magic link).
   Opcional mas recomendado para uso pessoal: desativar *Allow new users to sign up* depois
   de criares a tua conta.
5. Copiar de **Project Settings → API** o *Project URL* e a chave *anon*/*publishable*.
   **Nunca** usar a `service_role`/`secret` key na app.

### 2. Netlify

1. Pôr o repositório num remote Git (ex.: GitHub) e, no Netlify, *Add new site → Import an existing
   project*. O `netlify.toml` já define o build (`pnpm build`) e a pasta publicada (`apps/web/dist`).
2. Em **Site configuration → Environment variables**: `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
   com os valores do passo 1.5.
3. Fazer deploy e testar: entrar por magic link, registar uma sessão, exportar o progresso.
