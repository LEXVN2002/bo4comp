import { useParams } from 'react-router';
import { PagePlaceholder } from '../components/PagePlaceholder';

export default function Weapon() {
  const { weaponId } = useParams();
  return (
    <PagePlaceholder
      title={`Arma: ${weaponId ?? ''}`}
      description="Progresso camo a camo, com barra até ao próximo desbloqueio."
    />
  );
}
