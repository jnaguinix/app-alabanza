import { AppProvider, useApp } from './app-context';
import { Shell } from './components/Shell';
import { ShareHost } from './components/ShareHost';
import Editor from './pages/Editor';
import History from './pages/History';
import Home from './pages/Home';
import Reports from './pages/Reports';

function Router() {
  const { page, editDate } = useApp();
  if (page === 'historial') return <History />;
  if (page === 'registro') return <Editor key={editDate || 'nuevo'} />;
  if (page === 'reportes') return <Reports />;
  return <Home />;
}

export default function App() {
  return (
    <AppProvider>
      <ShareHost>
        <Shell>
          <Router />
        </Shell>
      </ShareHost>
    </AppProvider>
  );
}
