interface Props {
  title: string;
  description: string;
}

/** Cabeçalho de um ecrã ainda por implementar (sem dados falsos). */
export function PagePlaceholder({ title, description }: Props) {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-zinc-400">{description}</p>
      <p className="rounded-md border border-dashed border-zinc-700 p-4 text-sm text-zinc-500">
        Ecrã em construção.
      </p>
    </section>
  );
}
