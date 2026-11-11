import { createBrowserRouter, RouterProvider } from 'react-router';
import { Layout } from './components/Layout';
import Camos from './routes/Camos';
import Dashboard from './routes/Dashboard';
import EasterEggs from './routes/EasterEggs';
import NewSession from './routes/NewSession';
import NotFound from './routes/NotFound';
import Sessions from './routes/Sessions';
import Weapon from './routes/Weapon';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/camos', element: <Camos /> },
      { path: '/camos/:weaponId', element: <Weapon /> },
      { path: '/easter-eggs', element: <EasterEggs /> },
      { path: '/sessions/new', element: <NewSession /> },
      { path: '/sessions', element: <Sessions /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
