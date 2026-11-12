# BO4 Zombies Companion — Especificação para o Claude Code

Nov 11, 2026 · @Lexan

## Visão geral

O BO4 Zombies Companion é uma web app pessoal (React + Supabase) para acompanhar o grind de Call of Duty: Black Ops 4 Zombies: camos por arma, easter eggs principais e secundários, desafios de mapa e recordes de ronda. A Fase 1 é 100% manual e tem de funcionar sozinha; as fases seguintes acrescentam importação automática, sempre opcional.

**Objetivos**

- Ver num só ecrã quanto falta para completar cada arma, cada mapa e cada easter egg.
- Registar uma sessão de jogo em menos de 30 segundos no fim de cada partida.
- Conteúdo do jogo (mapas, armas, camos, passos de easter eggs) guardado em ficheiros JSON de seed, editáveis sem mexer em código.
- Interface em português europeu, tema escuro.

**O que a app NÃO faz**

- Não faz login com a Battle.net para ir buscar dados de CoD: a API da Blizzard não expõe dados de Call of Duty.
- Não lê a memória do jogo, não injeta nada no processo e não modifica ficheiros do jogo.
- Não promete “tempo real” na Fase 1; isso só aparece com o OCR da Fase 3.

## Stack e estrutura do projeto

A stack é Vite + React + TypeScript no frontend e Supabase (Postgres, Auth, RLS) no backend, num monorepo pnpm para a app desktop da Fase 3 poder reutilizar os tipos e os dados.

| Camada | Escolha | Notas |
| --- | --- | --- |
| Frontend | Vite, React 18, TypeScript estrito | React Router para navegação |
| Estilo | Tailwind CSS | Tema escuro por defeito |
| Estado do servidor | TanStack Query | Cache e updates otimistas |
| Validação | Zod | Valida os JSON de seed e os formulários |
| Backend | Supabase | Auth por email/magic link, RLS em todas as tabelas |
| Testes | Vitest + Testing Library | Lógica de progresso com testes unitários |
| Desktop (Fase 3) | Tauri 2 | Captura de ecrã e OCR locais |
| Deploy | Netlify | Igual ao que já usas noutros projetos |

```text
bo4-zombies-companion/
├─ CLAUDE.md
├─ apps/
│  ├─ web/                  # app React (Fase 1 e 2)
│  │  └─ src/
│  │     ├─ routes/          # um ficheiro por ecrã
│  │     ├─ components/
│  │     ├─ features/        # camos, easter-eggs, sessions, challenges
│  │     └─ lib/             # supabase client, cálculo de progresso
│  └─ desktop/              # Tauri (Fase 3), criado só nessa fase
├─ packages/
│  ├─ game-data/            # JSON de seed + schemas Zod
│  │  ├─ maps.json
│  │  ├─ weapons.json
│  │  ├─ camos.json
│  │  ├─ easter-eggs.json
│  │  └─ challenges.json
│  └─ shared/               # tipos TypeScript partilhados
└─ supabase/
   ├─ migrations/
   └─ seed.sql              # gerado a partir de game-data
```

## Modelo de dados

Há dois grupos de tabelas: o catálogo do jogo (só leitura, preenchido a partir dos JSON de seed) e o progresso do utilizador (protegido por RLS com `user_id = auth.uid()`). O progresso nunca guarda texto do catálogo, só ids com slug estável, para o seed poder ser corrigido sem partir dados.

```sql
-- CATÁLOGO (leitura pública para utilizadores autenticados)
create table maps (
  id text primary key,             -- slug: 'ix', 'voyage-of-despair'
  name text not null,
  storyline text not null check (storyline in ('chaos','aether')),
  release_order int not null,
  is_dlc boolean not null default false
);

create table weapons (
  id text primary key,             -- slug: 'saug-9mm'
  name text not null,
  weapon_class text not null,      -- 'smg','ar','tactical','lmg','sniper','pistol','shotgun','launcher','melee','special'
  source text not null default 'base' -- 'base','dlc','reserves'
);

create table camos (
  id text primary key,             -- slug: 'overgrowth'
  name text not null,
  tier int not null,               -- ordem de desbloqueio
  kind text not null check (kind in ('zombies','mastery','reactive')),
  requirement_type text not null,  -- 'kills','headshots','prereq_all', etc.
  requirement_value int,           -- null quando ainda não confirmado
  requirement_text text not null,
  verified boolean not null default false
);

create table easter_eggs (
  id text primary key,
  map_id text not null references maps(id),
  name text not null,
  type text not null check (type in ('main','side','song','music','other')),
  min_players int, max_players int,
  verified boolean not null default false,
  sources text[] not null default '{}'   -- links dos guias usados nos passos
);

create table easter_egg_steps (
  id text primary key,
  easter_egg_id text not null references easter_eggs(id) on delete cascade,
  step_order int not null,
  section text,                          -- ex.: 'Pack-a-Punch', 'Escudo', 'Quest principal'
  title text not null,
  details text,
  unique (easter_egg_id, step_order)
);

create table challenges (
  id text primary key,
  map_id text references maps(id), -- null = desafio global
  name text not null,
  description text not null,
  target int not null default 1
);

-- PROGRESSO DO UTILIZADOR (RLS: user_id = auth.uid())
create table weapon_camo_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  weapon_id text not null references weapons(id),
  camo_id text not null references camos(id),
  current_count int not null default 0,
  unlocked_at timestamptz,
  primary key (user_id, weapon_id, camo_id)
);

create table easter_egg_step_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  step_id text not null references easter_egg_steps(id),
  done_at timestamptz not null default now(),
  primary key (user_id, step_id)
);

create table easter_egg_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  easter_egg_id text not null references easter_eggs(id),
  completed_at timestamptz not null default now(),
  players int, notes text
);

create table challenge_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge_id text not null references challenges(id),
  current_count int not null default 0,
  completed_at timestamptz,
  primary key (user_id, challenge_id)
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  map_id text not null references maps(id),
  played_at timestamptz not null default now(),
  round_reached int not null,
  mode text not null default 'normal', -- 'casual','normal','hardcore','realistic','rush','gauntlet'
  players int not null default 1,
  source text not null default 'manual' check (source in ('manual','api','ocr')),
  notes text
);

create table session_weapon_stats (
  session_id uuid not null references sessions(id) on delete cascade,
  weapon_id text not null references weapons(id),
  kills int not null default 0,
  headshots int not null default 0,
  primary key (session_id, weapon_id)
);
```

Regras para o Claude Code:

- Ativar RLS em todas as tabelas. Catálogo: só `select` para `authenticated`. Progresso: `select/insert/update/delete` apenas onde `user_id = auth.uid()` (para `session_weapon_stats`, via join a `sessions`).
- Ao gravar uma sessão, uma função Postgres (`record_session`) soma kills e headshots ao `current_count` dos camos ainda bloqueados e marca `unlocked_at` quando o valor chega ao `requirement_value`. Camos com `requirement_value` nulo nunca desbloqueiam sozinhos.
- Camos do tipo `prereq_all` (mastery) desbloqueiam quando todos os camos anteriores dessa arma estão desbloqueados.

## Conteúdo do jogo (dados de seed)

O seed começa com os 8 mapas, as armas base e os nomes dos camos; os requisitos exatos dos camos e os passos dos easter eggs entram com `verified: false` até serem confirmados no jogo ou num guia. O Claude Code nunca deve inventar requisitos nem passos: campo desconhecido fica `null` e aparece na UI como “por confirmar”.

**Mapas**

| id | Nome | História | Ordem | Easter egg principal |
| --- | --- | --- | --- | --- |
| `ix` | IX | Chaos | 1 | Sim |
| `voyage-of-despair` | Voyage of Despair | Chaos | 2 | Sim |
| `blood-of-the-dead` | Blood of the Dead | Aether | 3 | Sim |
| `classified` | Classified | Aether | 4 | Não (confirmar); Project Skadi registado como secundário |
| `dead-of-the-night` | Dead of the Night | Chaos | 5 (DLC 1) | Sim |
| `ancient-evil` | Ancient Evil | Chaos | 6 (DLC 2) | Sim |
| `alpha-omega` | Alpha Omega | Aether | 7 (DLC 3) | Sim |
| `tag-der-toten` | Tag der Toten | Aether | 8 (DLC 4) | Sim |

**Armas base por classe** (as armas de DLC e das Black Market Reserves entram depois, com `source: "dlc"` ou `"reserves"`)

| Classe | Armas |
| --- | --- |
| SMG | MX9, Saug 9mm, Spitfire, Cordite, GKS |
| Assault rifle | ICR-7, KN-57, Maddox RFB, Rampart 17, Vapr-XKG |
| Tactical rifle | ABR 223, Auger DMR, Swordfish |
| LMG | Titan, VKM 750, Hades |
| Sniper | Paladin HB50, Outlaw, SDM, Koshka |
| Pistol | RK 7 Garrison, Mozu, Strife |
| Shotgun | MOG 12, SG12 |
| Launcher | Hellion Salvo |

**Camos**

O BO4 tem 14 camos exclusivos de Zombies ([Dexerto](https://www.dexerto.com/call-of-duty/full-gallery-of-black-ops-4-zombies-weapon-camos-238001/), [Dot Esports](https://dotesports.com/call-of-duty/news/how-to-get-weapon-camos-cod-black-ops-4-zombies)): Overgrowth, Tundra, Rend, Tropic, Roil, Mangrove, Clash, Dune, Green Tiger, Gutter Ball, Spore, Red Hex Redux, Emerald UG e Silverfish. Os camos de mastery (Gold, Diamond, Dark Matter) e os camos reativos chegaram ao modo Zombies numa atualização posterior ([Charlie INTEL](https://www.charlieintel.com/news/how-to-unlock-mastery-camos-in-call-of-duty-black-ops-4-zombies-51332/)). A ordem e os requisitos de cada um ficam por confirmar no menu de desafios do jogo.

**Formato dos ficheiros JSON**

```json
// packages/game-data/camos.json
[
  {
    "id": "overgrowth",
    "name": "Overgrowth",
    "tier": 1,
    "kind": "zombies",
    "requirement_type": "kills",
    "requirement_value": null,
    "requirement_text": "Por confirmar no jogo",
    "verified": false
  },
  {
    "id": "gold",
    "name": "Gold",
    "tier": 15,
    "kind": "mastery",
    "requirement_type": "prereq_all",
    "requirement_value": null,
    "requirement_text": "Desbloquear todos os camos anteriores da arma (confirmar)",
    "verified": false
  }
]
```

```json
// packages/game-data/easter-eggs.json
[
  {
    "id": "ix-main",
    "map_id": "ix",
    "name": "IX — Main Quest",
    "type": "main",
    "min_players": 1,
    "max_players": 4,
    "verified": false,
    "steps": [
      { "order": 1, "title": "Passo por preencher", "details": null }
    ]
  }
]
```

- Cada ficheiro tem um schema Zod em `packages/game-data/schemas.ts`; o build falha se um JSON não validar.
- Um script `pnpm seed` gera `supabase/seed.sql` com `insert ... on conflict (id) do update`, para correr várias vezes sem duplicar.
- Os passos dos easter eggs são preenchidos por ti a partir de um guia; a app tem de funcionar com zero passos (mostra só “concluído / não concluído”).

## Fase 1: MVP manual

O MVP tem seis ecrãs e o fluxo principal é “registar sessão → progresso atualiza sozinho”.

| Ecrã | Rota | O que mostra e permite |
| --- | --- | --- |
| Dashboard | `/` | Percentagem total de camos, easter eggs concluídos (x/8 principais), melhor ronda por mapa, últimas 5 sessões |
| Camos | `/camos` | Grelha arma × camo, filtro por classe; clique numa célula abre contador editável e botão “desbloqueado” |
| Arma | `/camos/:weaponId` | Progresso de uma arma camo a camo, com barra até ao próximo desbloqueio |
| Easter eggs | `/easter-eggs` | Cartões por mapa; checklist de passos; botão “marcar como concluído” que cria uma completion |
| Registar sessão | `/sessions/new` | Mapa, modo, jogadores, ronda; tabela rápida de armas usadas com kills e headshots |
| Histórico | `/sessions` | Lista de sessões com filtros por mapa e modo; editar e apagar |

Detalhes de comportamento:

- Formulário de sessão pensado para ser rápido: o último mapa e modo usados vêm pré-selecionados, e as armas aparecem por pesquisa com autocompletar.
- Updates otimistas no checklist de easter eggs (marcar um passo não espera pelo servidor).
- Camos e passos com `verified: false` mostram um pequeno selo “por confirmar”.
- Exportar e importar todo o progresso em JSON (botão nas definições), para backup.
- Layout responsivo: tem de ser usável no telemóvel ao lado do PC enquanto jogas.

## Fase 2: sync com a API não oficial

A Fase 2 começa com um teste de viabilidade de um dia: se a API não devolver dados de BO4 Zombies para a tua conta, a fase é cancelada e passa-se à Fase 3. A API é a que o site callofduty.com usa internamente; não é documentada e a Activision já a fechou e alterou várias vezes ([Charlie INTEL](https://charlieintel.com/call-of-duty-api-changes-kill-third-party-statistic-tracking-websites-and-services/52576)).

**Teste de viabilidade (primeira tarefa)**

1. Na conta Activision, em Linked Accounts, pôr a visibilidade dos dados em “todos”.
2. Usar um wrapper existente (por exemplo o pacote npm `call-of-duty-api`) num script Node isolado, com plataforma `battle` e o teu ID Battle.net.
3. Pedir os dados de BO4 e guardar a resposta crua em `spikes/bo4-response.json` (fora do git).
4. Anotar que campos de Zombies existem (rondas, kills por arma, mapas). Só se houver kills por arma vale a pena ligar ao tracker de camos.

**Se o teste passar**

- As chamadas à API correm numa Supabase Edge Function, nunca no browser.
- Autenticação: o utilizador cola o token de sessão do site (cookie SSO); a password da conta Activision nunca é pedida nem guardada. O token fica cifrado (Supabase Vault) e pode ser apagado com um botão.
- Sync manual por botão, no máximo uma vez a cada 10 minutos; nada de polling contínuo.
- A sync calcula a diferença entre o snapshot anterior e o atual e cria uma `session` com `source = 'api'`; nunca escreve por cima de dados manuais.
- Se a API falhar ou mudar, a app mostra “sync indisponível” e continua a funcionar em modo manual.

## Fase 3: deteção por OCR

A Fase 3 é uma app desktop Tauri que tira capturas do ecrã a intervalos e lê texto com OCR local, sem tocar no processo do jogo. É a única forma segura de chegar perto do “tempo real”.

- **Captura:** só do monitor ou da janela, com a API de captura do sistema (Windows Graphics Capture). Nada de hooks, overlays injetados ou leitura de memória.
- **OCR:** Tesseract ou o OCR nativo do Windows, aplicado só a regiões recortadas (contador de ronda, ecrã de fim de jogo, notificação de desafio). Regiões definidas em percentagem do ecrã, calibráveis para 1080p e outras resoluções.
- **Frequência:** uma captura a cada 2 segundos durante o jogo; quando deteta o ecrã de fim de jogo, guarda mapa e ronda.
- **Confirmação:** o que o OCR lê entra como rascunho de sessão (`source = 'ocr'`) que confirmas ou corriges com um clique. Nada é gravado sem confirmação.
- **Privacidade:** as capturas ficam em memória e são descartadas; só o texto extraído vai para o Supabase.
- **Calibração:** um ecrã de calibração onde carregas um screenshot teu e ajustas as caixas das regiões.

## Regras e limites

Estas regras protegem a tua conta e são obrigatórias em todas as fases; o Claude Code deve recusar implementar qualquer coisa que as quebre.

- Proibido ler ou escrever memória do processo do jogo, injetar DLLs, usar hooks de DirectX ou automatizar inputs. Qualquer um destes pode ser detetado pelo anti-cheat e levar a ban.
- Proibido pedir, guardar ou enviar a password da Battle.net ou da Activision.
- Tokens de sessão só em Supabase Vault ou variáveis de ambiente, nunca no repositório nem no `localStorage`. Ficheiro `.env.example` sem valores reais.
- A API não oficial é só para uso pessoal. A app não é publicada como serviço público de stats: a Activision já mandou fechar um site por usar a API ([NME](https://www.nme.com/news/activision-demand-shut-down-of-call-of-duty-warzone-stat-site-2909351)).
- Sem assets do jogo (imagens de camos, logos, ícones de armas). A UI usa ícones e cores próprios.
- Conteúdo de guias de terceiros é resumido por palavras tuas nos passos dos easter eggs, com link para o guia original.

## Roadmap e critérios de aceitação

Cada fase só começa quando todos os critérios da anterior estão marcados.

**Fase 1: MVP manual**

- [ ] Monorepo criado, `pnpm dev` arranca a app web sem erros
- [ ] Migrações aplicadas, RLS ativo e testado com dois utilizadores diferentes
- [ ] `pnpm seed` valida os JSON com Zod e gera `seed.sql` idempotente
- [ ] Os seis ecrãs funcionam no desktop e no telemóvel
- [ ] Registar uma sessão atualiza os contadores de camos corretamente (teste unitário da lógica de progresso)
- [ ] Exportar e importar progresso em JSON sem perda de dados
- [ ] Deploy no Netlify

**Fase 2: sync API**

- [ ] Teste de viabilidade feito e resultado anotado no README
- [ ] Edge Function de sync com token cifrado e limite de 1 sync por 10 minutos
- [ ] Sync cria sessões `source = 'api'` sem tocar em dados manuais
- [ ] Falha da API mostra aviso e a app continua em modo manual

**Fase 3: OCR desktop**

- [ ] App Tauri captura o ecrã sem tocar no processo do jogo
- [ ] OCR lê a ronda e o ecrã de fim de jogo em 1080p com pelo menos 90% de acerto em 20 capturas de teste
- [ ] Rascunhos de sessão só gravam depois de confirmados
- [ ] Ecrã de calibração de regiões funcional

## CLAUDE.md e primeiro prompt

Copia o bloco abaixo para `CLAUDE.md` na raiz do repositório e coloca este documento inteiro em `docs/SPEC.md` (exporta-o em Markdown). Depois usa o primeiro prompt para arrancar o Claude Code.

```markdown
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
```

**Primeiro prompt para o Claude Code**

```text
Lê o CLAUDE.md e o docs/SPEC.md. Vamos implementar a Fase 1.
Começa por: (1) criar o monorepo pnpm com a estrutura de pastas da spec,
(2) escrever as migrações SQL com RLS, (3) criar packages/game-data com
os JSON de mapas, armas e camos da spec e os schemas Zod, (4) o script
pnpm seed. Antes de escrever código, mostra-me o plano em passos curtos
e espera pela minha confirmação.
```
