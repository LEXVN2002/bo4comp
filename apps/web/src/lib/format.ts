const dateTime = new Intl.DateTimeFormat('pt-PT', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** Data e hora curtas em pt-PT (ex.: "11/11/2026, 23:15"). */
export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export function formatPlayers(n: number): string {
  return n === 1 ? '1 jogador' : `${n} jogadores`;
}
