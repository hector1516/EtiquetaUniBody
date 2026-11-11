import { useState, useEffect } from 'react';
import { api } from './api';
import { listen } from '@tauri-apps/api/event';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import LabelDesigner from './pages/LabelDesigner';
import History from './pages/History';

type Tab = 'dashboard' | 'designer' | 'history' | 'settings';

const NAV: { id: Tab; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '■' },
  { id: 'designer', label: 'Diseñador', icon: '✎' },
  { id: 'history', label: 'Historial', icon: '☰' },
  { id: 'settings', label: 'Configuración', icon: '⚙' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [health, setHealth] = useState<boolean>(false);

  useEffect(() => {
    const check = async () => {
      try { await api.get('/health'); setHealth(true); }
      catch { setHealth(false); }
    };
    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, []);

  // Apple HIG desktop: menu bar drives navigation too.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        unlisten = await listen<string>('menu:navigate', (e) => {
          if (e.payload === 'settings') setTab('settings');
          if (e.payload === 'dashboard') setTab('dashboard');
          if (e.payload === 'designer') setTab('designer');
          if (e.payload === 'history') setTab('history');
        });
      } catch {}
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  return (
    <div className="h-full flex">
      {/* Sidebar (Apple HIG desktop: top-level sections in a sidebar) */}
      <aside className="w-56 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="px-4 py-4 flex items-center gap-3 border-b border-zinc-800">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white">E</div>
          <div>
            <h1 className="text-sm font-semibold leading-tight">Espumado Insight</h1>
            <p className="text-[10px] text-zinc-500">EtiquetaUniBody</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1" aria-label="Navegación principal">
          {NAV.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}`}>
              <span className="w-5 text-center" aria-hidden="true">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-3 border-t border-zinc-800 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${health ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
          <span className="text-xs text-zinc-400">{health ? 'Backend OK' : 'Sin conexión'}</span>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6 bg-neutral-950">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'designer' && <LabelDesigner />}
        {tab === 'history' && <History />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
