import { useEffect } from 'react';
import { useHash } from './hooks';
import { isAuthed, requireAuth } from './lib/api';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

export default function App() {
  const h = useHash();
  const isApp = h === 'app' || h.startsWith('app/');
  const page = h === 'login' ? 'login' : isApp ? 'app' : 'home';
  const blocked = isApp && requireAuth && !isAuthed();

  useEffect(() => { window.scrollTo(0, 0); }, [page]);
  useEffect(() => { if (blocked) window.location.hash = '#/login'; }, [blocked]);
  useEffect(() => {
    if (isApp && (h === 'app' || h === 'app/')) {
      window.location.hash = '#/app/write';
    }
  }, [isApp, h]);

  if (blocked) return null;
  if (page === 'login') return <Login />;
  if (page === 'app') return <Dashboard subpath={h.startsWith('app/') ? h.slice(4) : 'write'} />;
  return <Landing />;
}
