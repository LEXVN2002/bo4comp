import { Link } from 'react-router';

export default function NotFound() {
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">Página não encontrada</h1>
      <Link to="/" className="text-emerald-400 hover:underline">
        Voltar ao painel
      </Link>
    </section>
  );
}
