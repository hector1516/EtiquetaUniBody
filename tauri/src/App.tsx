import { useState, useEffect } from 'react';
import { api } from './api';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import LabelDesigner from './pages/LabelDesigner';
import History from './pages/History';

type Tab = 'dashboard' | 'designer' | 'history' | 'settings';

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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'designer', label: 'Diseñador' },
    { id: 'history', label: 'Historial' },
    { id: 'settings', label: 'Configuración' },
  ];

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">E</div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Espumado Insight</h1>
            <p className="text-xs text-zinc-500">EtiquetaUniBody · Generador e Impresor de Etiquetas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${health ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs text-zinc-400">{health ? 'Backend OK' : 'Sin conexión'}</span>
        </div>
      </header>
      <nav className="flex gap-1 px-6 py-2 border-b border-zinc-800 bg-zinc-950">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${tab === t.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900'}`}>
            {t.label}
          </button>
        ))}
      </nav>
      <main className="flex-1 overflow-auto p-6">
        {tab === 'dashboard' && <Dashboard />}
        {tab === 'designer' && <LabelDesigner />}
        {tab === 'history' && <History />}
        {tab === 'settings' && <Settings />}
      </main>
    </div>
  );
}
