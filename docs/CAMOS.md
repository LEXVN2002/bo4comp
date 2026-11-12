# Aba de Camos e funcionalidades de grind — especificação

Este ficheiro complementa o `docs/SPEC.md`. Lê os dois e o `CLAUDE.md` antes de começar.
Implementa por etapas (secção 9), mostrando o plano e as migrações antes de cada etapa
e esperando pela minha confirmação.

Regras que se mantêm:

- Interface em português europeu.
- Sem imagens, ícones, logos ou sons do jogo. Tudo gerado em CSS/SVG ou fornecido por mim.
- Nunca inventar requisitos de camos. `requirement_value` nulo = "por confirmar".
- RLS em todas as tabelas novas: `user_id = auth.uid()`.
- Não alterar o seed para guardar dados meus; usar as tabelas de utilizador.

---

## 1. Ecrã `/camos` — lista de armas

- Armas agrupadas por classe: SMG, Assault rifle, Tactical rifle, LMG, Sniper, Pistol,
  Shotgun, Launcher. Separadores por classe no topo + opção "Todas".
- Cada arma é um cartão com: nome, classe, barra de progresso (camos concluídos / total),
  ícone de alfinete para afixar/desafixar e selo quando tem todos os camos.
- **Filtros e ordenação** (barra no topo, estado guardado no URL como `?classe=smg&ordem=progresso`):
  - pesquisa por nome;
  - "só incompletas";
  - ordenar por: nome, % de progresso, mais perto de desbloquear.
- Acima da lista, a secção **Armas afixadas** (secção 3) e o botão **Grelha mestra** (secção 6).
- Clicar num cartão abre `/camos/:weaponId`.

## 2. Ecrã `/camos/:weaponId` — camos da arma

- Cabeçalho: nome da arma, classe, progresso total, botão afixar/desafixar,
  botão "Partilhar progresso" (secção 7).
- Grelha de camos por ordem de `tier`. Cada camo é um quadrado com padrão gerado em CSS
  (gradiente/padrão diferente por camo, derivado do id) e três estados visuais:
  - **bloqueado** (mastery com pré-requisitos por cumprir): escurecido, cadeado SVG;
  - **em progresso**: barra fina por baixo com a percentagem;
  - **concluído**: contorno néon e visto.
- Clicar num camo abre um painel (lateral no desktop, de baixo no telemóvel) com:
  - nome do camo e challenge (`requirement_text`, com override se existir);
  - contador "atual / objetivo" com barra, botões `-1`, `+1`, `+10` e campo numérico;
  - checkbox **Concluído** (marca/desmarca `unlocked_at`);
  - quando `current_count >= requirement_value`, marca como concluído automaticamente
    e dispara a animação de desbloqueio (secção 5);
  - se `verified = false`: selo "por confirmar" e campos para editar `requirement_text`
    e `requirement_value`, gravados em `user_camo_overrides`;
  - **notas do camo** (texto livre, gravação automática com debounce de 800 ms);
  - estimativa de partidas restantes (secção 4).
- Abaixo da grelha: **notas da arma** (texto livre) e **linha do tempo** da arma
  (camos concluídos com data, do mais recente para o mais antigo).
- Camos de mastery (`requirement_type = 'prereq_all'`: Gold, Diamond, Dark Matter) ficam
  bloqueados até todos os camos de tier inferior dessa arma estarem concluídos.

### Atalhos de teclado (só no desktop, desativados quando um campo de texto tem foco)

| Tecla | Ação |
| --- | --- |
| Setas | Navegar entre camos da grelha |
| `Enter` | Abrir/fechar o painel do camo selecionado |
| `+` / `-` | Contador +1 / -1 |
| `Shift` + `+` | Contador +10 |
| `C` | Alternar "Concluído" |
| `P` | Afixar/desafixar a arma |
| `Esc` | Fechar painel |
| `?` | Mostrar a lista de atalhos |

## 3. Armas afixadas

- Posso afixar **várias armas**, sem limite rígido (aviso visual a partir de 6).
- Ordem definida por mim com arrastar e largar; gravada em `pinned_weapons.sort_order`.
- Aparecem: no topo de `/camos`, no dashboard e como escolha rápida no modo grind.
- Cada arma afixada mostra o próximo camo por desbloquear e quanto falta.

## 4. "Mais perto de desbloquear" e estimativas

**Mais perto de desbloquear** — cartão no dashboard e opção de ordenação em `/camos`:

- Considerar, por arma, o próximo camo não concluído com `requirement_value` conhecido
  (override incluído) e não bloqueado.
- Ordenar por percentagem concluída (`current_count / requirement_value`) descendente;
  em empate, menor número em falta.
- Mostrar as 3 primeiras: arma, camo, "faltam X kills/headshots", barra.
- Camos "por confirmar" ficam de fora; se não houver nenhum com valor conhecido,
  mostrar mensagem a pedir para preencher os requisitos.

**Estimativa de partidas restantes**:

- Média por arma das últimas 10 sessões em que a arma foi usada, separada por
  kills e headshots (`session_weapon_stats`).
- `partidas = ceil(em_falta / média)` para o tipo de requisito do camo.
- Com menos de 3 sessões dessa arma, mostrar "dados insuficientes".
- Lógica numa função pura em `apps/web/src/lib/progress.ts`, com testes Vitest.

## 5. Modo grind ao vivo e animação de desbloqueio

### Modo grind — rota `/grind`

- Pensado para o telemóvel ao lado do PC: botões enormes, tema escuro, ecrã sempre
  ligado com a Wake Lock API quando disponível (ignorar em silêncio se não for).
- Início: escolher mapa, modo e jogadores (pré-preenchidos com a última sessão) e a arma
  ativa (armas afixadas em destaque, pesquisa para as outras).
- Durante a partida:
  - botões `+1 KILL` e `+1 HEADSHOT` (um headshot conta também como kill);
  - botão para desfazer o último toque;
  - trocar de arma a meio sem perder contagens;
  - mostrar ao vivo, para a arma ativa, o próximo camo e a barra **projetada**
    (progresso gravado + contagens desta sessão);
  - se a projeção atingir o objetivo, mostrar "desbloqueado ao terminar" sem gravar ainda.
- Terminar: pedir a ronda alcançada, mostrar resumo e gravar tudo de uma vez com a função
  `record_session` (que atualiza `weapon_camo_progress`). Só aí correm as animações.
- Uma sessão em curso tem `status = 'live'` e é guardada a cada toque (debounce 1 s), para
  não se perder se fechar o browser. Ao abrir `/grind` com uma sessão `live`, oferecer
  retomar ou descartar.
- Sessões `live` não contam para estimativas nem para progresso até serem terminadas.

### Animação de desbloqueio

- Sobreposição em ecrã cheio ~2,5 s: padrão do camo em CSS, nome do camo e da arma,
  texto "CAMO DESBLOQUEADO", entrada com brilho néon. Clicar fecha.
- Vários desbloqueios de uma vez entram em fila, um de cada vez.
- Som em `public/sounds/unlock.mp3` (fornecido por mim; se o ficheiro não existir,
  sem som e sem erros). Volume e "som ligado/desligado" nas definições.
- Respeitar `prefers-reduced-motion`: nesse caso, só um aviso discreto sem animação.
- Selos de classe (secção 6) usam a mesma animação com texto "MASTERY DE CLASSE".

## 6. Grelha mestra e selos de classe

**Grelha mestra** — rota `/camos/grelha`:

- Linhas = armas (agrupadas por classe), colunas = camos por tier.
- Célula colorida por estado: vazia, em progresso (intensidade pela %), concluída.
- Hover/toque mostra arma, camo e contador; clicar abre o painel desse camo.
- Cabeçalho de coluna fixo e scroll horizontal dentro do próprio contentor.

**Selos de classe**:

- Calculados, sem tabela: uma classe tem selo quando todas as armas dessa classe têm
  todos os camos concluídos (tiers zombies + mastery).
- Mostrados em `/camos` e no dashboard; bloqueados aparecem em cinzento com a % da classe.
- A data do selo é o `unlocked_at` mais recente entre os camos dessa classe.

## 7. Cartão de progresso para partilhar

- Botão em `/camos/:weaponId` e no dashboard (progresso global).
- Gera uma imagem PNG 1080×1350 em `<canvas>`: nome da arma (ou "Progresso global"),
  grelha de camos com estados, percentagem, selos de classe, data e o meu nome de jogador
  (definido nas definições).
- Estilo igual à app; sem assets do jogo.
- Ações: descarregar PNG e, no telemóvel, partilhar com a Web Share API se existir.

## 8. Objetivos

- Rota `/objetivos` e cartão no dashboard.
- Eu crio objetivos com: título, tipo, alvo, período (diário, semanal, sem prazo).
  Tipos:
  - `camo_count` — concluir N camos (opcionalmente numa arma ou classe);
  - `weapon_camo` — concluir um camo específico numa arma específica;
  - `kills` / `headshots` — fazer N com uma arma ou no total.
- Progresso calculado a partir de `weapon_camo_progress` e `sessions` dentro do período.
- Objetivos concluídos ficam no histórico; os periódicos renovam-se no período seguinte.

## 9. Ordem de implementação

1. Migrações da secção 10 + tipos TypeScript + funções puras de progresso com testes.
2. Ecrãs `/camos` e `/camos/:weaponId` com painel, overrides, notas, linha do tempo,
   filtros e atalhos.
3. Armas afixadas + "Mais perto de desbloquear" + estimativas.
4. Modo grind ao vivo + `record_session` + animação de desbloqueio.
5. Grelha mestra + selos de classe.
6. Cartão de partilha.
7. Objetivos.

No fim de cada etapa: `pnpm test` e `pnpm lint`, resumo do que mudou e commit com
mensagem clara.

## 10. Migrações

```sql
create table user_camo_overrides (
  user_id uuid not null references auth.users(id) on delete cascade,
  camo_id text not null references camos(id),
  -- Acrescentado na etapa 1: sem o tipo, camos 'unknown' não podem contar.
  requirement_type text check (requirement_type in ('kills','headshots')),
  requirement_text text,
  requirement_value int check (requirement_value > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, camo_id)
);

create table pinned_weapons (
  user_id uuid not null references auth.users(id) on delete cascade,
  weapon_id text not null references weapons(id),
  sort_order int not null default 0,
  pinned_at timestamptz not null default now(),
  primary key (user_id, weapon_id)
);

create table camo_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  weapon_id text not null references weapons(id),
  camo_id text not null references camos(id),
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, weapon_id, camo_id)
);

create table weapon_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  weapon_id text not null references weapons(id),
  body text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, weapon_id)
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  type text not null check (type in ('camo_count','weapon_camo','kills','headshots')),
  target int not null check (target > 0),
  weapon_id text references weapons(id),
  weapon_class text,
  camo_id text references camos(id),
  period text not null default 'none' check (period in ('daily','weekly','none')),
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create table user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  player_name text,
  sound_enabled boolean not null default true,
  sound_volume numeric not null default 0.6 check (sound_volume between 0 and 1),
  updated_at timestamptz not null default now()
);

-- Sessões ao vivo
alter table sessions
  add column status text not null default 'done' check (status in ('live','done')),
  alter column round_reached drop not null;

alter table sessions
  add constraint round_required_when_done
  check (status = 'live' or round_reached is not null);
```

- Ativar RLS e políticas `select/insert/update/delete` com `user_id = auth.uid()`
  em todas as tabelas acima.
- `record_session` passa a: receber o id de uma sessão `live`, marcá-la `done`, somar as
  contagens ao progresso respeitando overrides, e devolver a lista de camos desbloqueados
  (para a fila de animações).
- Índice em `session_weapon_stats (weapon_id)` e em `sessions (user_id, played_at desc)`
  para as estimativas.

## 11. Mais tarde (não implementar agora)

- **Sugestões do OCR (Fase 3):** sessões com `source = 'ocr'` entram como sugestão
  no contador do camo; eu confirmo antes de gravar. Deixar a função de aplicar contagens
  preparada para receber sessões de qualquer `source`.
- **Comparação com amigos:** ranking privado por convite, com % de camos e easter eggs.
  Exige um modelo de partilha entre utilizadores; fica para uma fase própria.
