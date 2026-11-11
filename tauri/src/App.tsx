import { useState, useEffect } from 'react';
import { api } from './api';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import SplitText from './components/SplitText';
import ClickSpark from './components/ClickSpark';
import PrintCelebration from './components/PrintCelebration';
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
  const [showQuit, setShowQuit] = useState(false);
  const [celebration, setCelebration] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const check = async () => {
      try { await api.get('/health'); setHealth(true); }
      catch { setHealth(false); }
    };
    check();
    const id = setInterval(check, 3000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const ev = await api.get('/trigger/events');
        if (Array.isArray(ev) && ev.length > 0) {
          setCelebration(ev[ev.length - 1]);
          setEvents(prev => [...ev, ...prev].slice(0, 50));
        }
      } catch {}
    }, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/system/accent-color');
        if (r?.hex) {
          document.documentElement.style.setProperty('--accent', r.hex);
          const n = parseInt(r.hex.slice(1), 16);
          const lr = Math.min(255, ((n >> 16) & 0xff) + 30);
          const lg = Math.min(255, ((n >> 8) & 0xff) + 30);
          const lb = Math.min(255, (n & 0xff) + 30);
          document.documentElement.style.setProperty('--accent-hover', `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`);
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    let unlistenMenu: (() => void) | undefined;
    let unlistenQuit: (() => void) | undefined;
    (async () => {
      try {
        unlistenMenu = await listen<any>('menu:navigate', (e) => {
          const p = e.payload;
          if (p === 'settings') setTab('settings');
          if (p === 'dashboard') setTab('dashboard');
          if (p === 'designer') setTab('designer');
          if (p === 'history') setTab('history');
        });
        unlistenQuit = await listen('tray:quit-request', () => setShowQuit(true));
      } catch {}
    })();
    return () => {
      if (unlistenMenu) unlistenMenu();
      if (unlistenQuit) unlistenQuit();
    };
  }, []);

  const confirmQuit = async () => {
    try { await invoke('quit_app'); } catch {}
    setShowQuit(false);
  };

  return (
    <div className="h-full flex">
      <aside className={`${sidebarOpen ? 'w-56' : 'w-14'} shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950/80 backdrop-blur-md transition-all duration-200`}>
        <div className="px-3 py-4 flex items-center gap-3 border-b border-zinc-800">
          <img src="/logo.png" alt="EtiquetaUniBody" className="w-8 h-8 object-contain shrink-0" />
          {sidebarOpen && (
            <div className="min-w-0">
              <SplitText text="Espumado Insight" className="text-sm font-semibold leading-tight" />
              <p className="text-[10px] text-zinc-500">EtiquetaUniBody</p>
            </div>
          )}
        </div>
        <nav className="flex-1 p-2 space-y-1" aria-label="Navegación principal">
          {NAV.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} title={t.label}
              aria-current={tab === t.id ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                ${tab === t.id ? 'nav-active' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}`}>
              <span className="w-5 text-center shrink-0" aria-hidden="true">{t.icon}</span>
              {sidebarOpen && <span className="truncate">{t.label}</span>}
            </button>
          ))}
        </nav>
        <div className="px-3 py-3 border-t border-zinc-800 flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full shrink-0 ${health ? 'bg-emerald-500' : 'bg-red-500'}`} aria-hidden="true" />
          {sidebarOpen && <span className="text-xs text-zinc-400 truncate">{health ? 'Backend OK' : 'Sin conexión'}</span>}
        </div>
        <button onClick={() => setSidebarOpen(o => !o)} className="px-3 py-2 border-t border-zinc-800 text-xs text-zinc-500 hover:text-zinc-200 text-left" aria-label="Colapsar sidebar">
          {sidebarOpen ? '◀ Colapsar' : '▶'}
        </button>
      </aside>

      <ClickSpark sparkColor="var(--accent)" sparkSize={8} sparkRadius={20} sparkCount={6}>
        <main className="flex-1 overflow-auto p-6 bg-neutral-950 relative">
          {tab === 'dashboard' && <Dashboard events={events} />}
          {tab === 'designer' && <LabelDesigner />}
          {tab === 'history' && <History />}
          {tab === 'settings' && <Settings />}
        </main>
      </ClickSpark>

      <img src="/logo.png" alt="" aria-hidden="true" className="pointer-events-none select-none fixed bottom-4 right-4 w-40 opacity-[0.05] z-0" />

      {showQuit && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <h3 className="font-semibold text-lg mb-2">¿Salir de EtiquetaUniBody?</h3>
            <p className="text-sm text-zinc-400 mb-4">
              La aplicación dejará de imprimir etiquetas y de guardar la información de los equipos en la base de datos.
              Los registros pendientes de sincronización con SQL Server se enviarán cuando vuelvas a abrir la app.
            </p>
            <div className="flex gap-2 justify-end">
              <button className="btn ghost" onClick={() => setShowQuit(false)}>Cancelar</button>
              <button className="btn danger" onClick={confirmQuit}>Salir y detener</button>
            </div>
          </div>
        </div>
      )}

      {celebration && (
        <PrintCelebration event={celebration} onClose={() => setCelebration(null)} />
      )}
    </div>
  );
}
