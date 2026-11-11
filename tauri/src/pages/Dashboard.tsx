import { useEffect, useState } from 'react';
import { api } from '../api';
import IsometricFlow from '../components/IsometricFlow';
import SpotlightCard from '../components/SpotlightCard';
import ShinyText from '../components/ShinyText';

export default function Dashboard({ events: externalEvents }: { events?: any[] }) {
  const [events, setEvents] = useState<any[]>(externalEvents ?? []);
  const [plcStatus, setPlcStatus] = useState<any>(null);
  const [printerStatus, setPrinterStatus] = useState<any>(null);
  const [cfg, setCfg] = useState<any>({});

  useEffect(() => {
    if (externalEvents) setEvents(externalEvents);
  }, [externalEvents]);

  useEffect(() => {
    const load = async () => {
      try { setCfg(await api.get('/config')); } catch {}
      try { setPlcStatus(await api.get('/plc/status')); } catch {}
      try { setPrinterStatus(await api.get('/printer/status')); } catch {}
    };
    load();
    const id = setInterval(async () => {
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
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="min-h-0 flex items-center justify-center">
          <IsometricFlow />
        </div>
        <div className="min-h-0 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            <SpotlightCard className="card p-3" spotlightColor="rgba(16, 185, 129, 0.15)">
              <div className="text-xs text-zinc-400 uppercase tracking-wide">PLC</div>
              <div className="mt-1 flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${plcStatus?.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="font-medium text-sm">{plcStatus?.connected ? 'Conectado' : 'Desconectado'}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-1 truncate">{plcStatus?.ip || cfg.plc_ip}</div>
              <button className="btn ghost mt-2 text-xs" onClick={testPlc}>Probar</button>
            </SpotlightCard>
            <SpotlightCard className="card p-3" spotlightColor="rgba(59, 130, 246, 0.15)">
              <div className="text-xs text-zinc-400 uppercase tracking-wide">Impresora</div>
              <div className="mt-1 font-medium text-sm truncate">{printerStatus?.ip || cfg.printer_ip}</div>
              <div className="text-xs text-zinc-500 mt-1">Puerto {printerStatus?.port || cfg.printer_port}</div>
              <button className="btn ghost mt-2 text-xs" onClick={testPrinter}>Prueba</button>
            </SpotlightCard>
            <SpotlightCard className="card p-3" spotlightColor="rgba(167, 139, 250, 0.15)">
              <div className="text-xs text-zinc-400 uppercase tracking-wide">SQL Server</div>
              <div className="mt-1 font-medium text-sm truncate">{cfg.sql_server}</div>
              <div className="text-xs text-zinc-500 mt-1 truncate">{cfg.sql_database}</div>
            </SpotlightCard>
          </div>

          <div className="card p-3 flex-1 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-semibold text-sm"><ShinyText text="Monitor en vivo" speed={3} /></h2>
              <span className="text-xs text-zinc-500">Eventos PLC</span>
            </div>
            {events.length === 0 ? (
              <div className="text-sm text-zinc-500 py-4 text-center" role="status">Esperando disparo del PLC…</div>
            ) : (
              <div className="space-y-1 overflow-auto h-full" aria-live="polite">
                {events.slice(0, 10).map((e, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded bg-zinc-800/50 border border-zinc-700">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${e.status === 'OK' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{e.serial ?? '—'} · {e.batch ?? '—'}</div>
                      <div className="text-xs text-zinc-500 truncate">{e.timestamp} · {e.status}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
