import { useEffect, useState } from 'react';
import { api } from '../api';
import IsometricFlow from '../components/IsometricFlow';

export default function Dashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [plcStatus, setPlcStatus] = useState<any>(null);
  const [printerStatus, setPrinterStatus] = useState<any>(null);
  const [cfg, setCfg] = useState<any>({});

  useEffect(() => {
    const load = async () => {
      try { setCfg(await api.get('/config')); } catch {}
      try { setPlcStatus(await api.get('/plc/status')); } catch {}
      try { setPrinterStatus(await api.get('/printer/status')); } catch {}
    };
    load();
    const id = setInterval(async () => {
      try {
        const ev = await api.get('/trigger/events');
        if (Array.isArray(ev) && ev.length) setEvents(e => [...ev, ...e].slice(0, 50));
      } catch {}
      try { setPlcStatus(await api.get('/plc/status')); } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const testPrinter = async () => {
    try { await api.post('/printer/test'); alert('Prueba enviada a la impresora'); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };
  const testPlc = async () => {
    try { const r = await api.post('/plc/test'); alert('PLC conectado: ' + r.connected); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };

  return (
    <div className="space-y-6">
      <IsometricFlow />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-5">
          <div className="text-xs text-zinc-400 uppercase tracking-wide">PLC</div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${plcStatus?.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="font-medium">{plcStatus?.connected ? 'Conectado' : 'Desconectado'}</span>
          </div>
          <div className="text-xs text-zinc-500 mt-1">{plcStatus?.ip || cfg.plc_ip}</div>
          <button className="btn ghost mt-3 text-sm" onClick={testPlc}>Probar conexión</button>
        </div>
        <div className="card p-5">
          <div className="text-xs text-zinc-400 uppercase tracking-wide">Impresora Zebra</div>
          <div className="mt-2 font-medium">{printerStatus?.ip || cfg.printer_ip}</div>
          <div className="text-xs text-zinc-500 mt-1">Puerto {printerStatus?.port || cfg.printer_port}</div>
          <button className="btn ghost mt-3 text-sm" onClick={testPrinter}>Impresión de prueba</button>
        </div>
        <div className="card p-5">
          <div className="text-xs text-zinc-400 uppercase tracking-wide">SQL Server</div>
          <div className="mt-2 font-medium">{cfg.sql_server}</div>
          <div className="text-xs text-zinc-500 mt-1">{cfg.sql_database}</div>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Monitor en vivo</h2>
          <span className="text-xs text-zinc-500">Eventos de disparo PLC</span>
        </div>
        {events.length === 0 ? (
          <div className="text-sm text-zinc-500 py-8 text-center" role="status">Esperando disparo del PLC…</div>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto" aria-live="polite">
            {events.map((e, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
                <span className={`w-2 h-2 rounded-full ${e.status === 'OK' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{e.serial ?? '—'} · {e.batch ?? '—'}</div>
                  <div className="text-xs text-zinc-500">{e.timestamp} · {e.status}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
