import { useEffect, useState } from 'react';
import { api } from '../api';

export default function History() {
  const [rows, setRows] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);

  const load = async () => {
    try {
      const r = await api.get('/audit?limit=100');
      setRows(Array.isArray(r) ? r : []);
    } catch {}
  };
  useEffect(() => { load(); const id = setInterval(load, 3000); return () => clearInterval(id); }, []);

  const reprint = async (id: number) => {
    try { const r = await api.post('/audit/reprint', { id }); alert(r.ok ? 'Reimpresión enviada' : 'Error: ' + r.error); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };
  const view = async (id: number) => {
    try { setSelected(await api.get(`/audit/${id}`)); } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h2 className="font-semibold mb-3">Historial de etiquetas emitidas</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">ID</th>
                <th className="text-left py-2">Timestamp</th>
                <th className="text-left py-2">Serial</th>
                <th className="text-left py-2">Lote</th>
                <th className="text-left py-2">Estado</th>
                <th className="text-left py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-b border-zinc-800 hover:bg-zinc-800/40">
                  <td className="py-2">{r.id}</td>
                  <td className="py-2 text-xs">{r.timestamp}</td>
                  <td className="py-2 font-mono">{r.serial ?? '—'}</td>
                  <td className="py-2">{r.batch ?? '—'}</td>
                  <td className="py-2">
                    <span className={`px-2 py-0.5 rounded text-xs ${r.status === 'OK' ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'}`}>{r.status}</span>
                  </td>
                  <td className="py-2 flex gap-2">
                    <button className="btn ghost text-xs px-2 py-1" onClick={() => view(r.id)}>Ver</button>
                    <button className="btn ok text-xs px-2 py-1" onClick={() => reprint(r.id)}>Reimprimir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {selected && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">ZPL · ID {selected.id}</h3>
            <button className="btn ghost text-xs" onClick={() => setSelected(null)}>Cerrar</button>
          </div>
          <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 overflow-auto max-h-64">{selected.zpl}</pre>
        </div>
      )}
    </div>
  );
}
