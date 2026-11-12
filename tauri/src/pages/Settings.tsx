import { useEffect, useState } from 'react';
import { api } from '../api';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getVersion } from '@tauri-apps/api/app';

export default function Settings() {
  const [cfg, setCfg] = useState<any>({});
  const [tags, setTags] = useState<any[]>([]);
  const [newTag, setNewTag] = useState({ name: '', tag_name: '', data_type: 'DINT', app_variable: 'CUSTOM', is_trigger: false });
  const [tableStatus, setTableStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);
  const [updateStatus, setUpdateStatus] = useState('');
  const [checking, setChecking] = useState(false);
  const [appVersion, setAppVersion] = useState('');

  const load = async () => {
    try { setCfg(await api.get('/config')); } catch {}
    try { setTags(await api.get('/plc/tags')); } catch {}
    try { setTableStatus(await api.get('/audit/tables-status')); } catch {}
  };
  useEffect(() => { load(); getVersion().then(setAppVersion).catch(() => setAppVersion('1.0.0')); }, []);

  const saveCfg = async (keys: string[]) => {
    const vals: any = {};
    keys.forEach(k => { if (cfg[k] !== undefined) vals[k] = cfg[k]; });
    try { await api.post('/config', { values: vals }); alert('Guardado'); load(); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };
  const addTag = async () => {
    try { await api.post('/plc/tags', newTag); setNewTag({ name: '', tag_name: '', data_type: 'DINT', app_variable: 'CUSTOM', is_trigger: false }); load(); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };
  const delTag = async (id: number) => { try { await api.del(`/plc/tags/${id}`); load(); } catch {} };
  const ensureTable = async () => {
    try { const r = await api.post('/audit/ensure-table'); alert(r.exists ? 'Tabla ya existe / creada' : 'No se pudo crear'); load(); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };
  const syncNow = async () => {
    setSyncing(true);
    try { const r = await api.post('/audit/sync'); alert(`Sincronizado. Pendientes: ${r.pending}`); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
    finally { setSyncing(false); }
  };

  const field = (key: string, label: string, type = 'text') => (
    <div>
      <label className="text-xs text-[var(--text-muted)]">{label}</label>
      <input className="input" type={type} value={cfg[key] ?? ''} onChange={e => setCfg({ ...cfg, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4 overflow-hidden">
      {/* Columna izquierda: PLC + Impresora */}
      <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="card p-3 space-y-2 shrink-0">
          <h2 className="font-semibold text-emerald-400 text-sm">PLC (Allen-Bradley ControlLogix)</h2>
          <div className="grid grid-cols-2 gap-2">
            {field('plc_ip', 'IP del PLC')}
            {field('plc_slot', 'Slot', 'number')}
          </div>
          <button className="btn ok text-sm" onClick={() => saveCfg(['plc_ip', 'plc_slot'])}>Guardar PLC</button>
        </div>

        <div className="card p-3 space-y-2 shrink-0">
          <h2 className="font-semibold text-blue-400 text-sm">Impresora Zebra (ZPL)</h2>
          <div className="grid grid-cols-2 gap-2">
            {field('printer_ip', 'IP de la impresora')}
            {field('printer_port', 'Puerto', 'number')}
            <div>
              <label className="text-xs text-[var(--text-muted)]">Resolución (DPI)</label>
              <select className="input" value={cfg.printer_dpi ?? '203'} onChange={e => setCfg({ ...cfg, printer_dpi: e.target.value })}>
                <option value="203">203 dpi (estándar)</option>
                <option value="300">300 dpi (alta resolución)</option>
              </select>
            </div>
          </div>
          <button className="btn ok text-sm" onClick={() => saveCfg(['printer_ip', 'printer_port', 'printer_dpi'])}>Guardar impresora</button>
        </div>

        <div className="card p-3 space-y-2 flex-1 min-h-0 overflow-hidden">
          <h3 className="font-semibold text-sm">Tags del PLC</h3>
          <div className="overflow-auto flex-1 min-h-0">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[var(--text-muted)] border-b border-[var(--border)]">
                  <th className="text-left py-1">Alias</th>
                  <th className="text-left py-1">Tag PLC</th>
                  <th className="text-left py-1">Tipo</th>
                  <th className="text-left py-1">Var</th>
                  <th className="text-left py-1">Trg</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tags.map(t => (
                  <tr key={t.id} className="border-b border-[var(--border)]">
                    <td className="py-1">{t.name}</td>
                    <td className="py-1 font-mono text-[10px]">{t.tag_name}</td>
                    <td className="py-1">{t.data_type}</td>
                    <td className="py-1">{t.app_variable}</td>
                    <td className="py-1">{t.is_trigger ? '✓' : ''}</td>
                    <td className="py-1"><button className="btn danger text-xs px-1 py-0" onClick={() => delTag(t.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-5 gap-1 shrink-0">
            <input className="input text-xs" placeholder="Alias" value={newTag.name} onChange={e => setNewTag({ ...newTag, name: e.target.value })} />
            <input className="input text-xs" placeholder="Tag PLC" value={newTag.tag_name} onChange={e => setNewTag({ ...newTag, tag_name: e.target.value })} />
            <select className="input text-xs" value={newTag.data_type} onChange={e => setNewTag({ ...newTag, data_type: e.target.value })}>
              <option>BOOL</option><option>DINT</option><option>REAL</option><option>STRING</option>
            </select>
            <select className="input text-xs" value={newTag.app_variable} onChange={e => setNewTag({ ...newTag, app_variable: e.target.value })}>
              <option>CUSTOM</option><option>SERIAL</option><option>BATCH</option><option>TRIGGER</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-[var(--text)]">
              <input type="checkbox" checked={newTag.is_trigger} onChange={e => setNewTag({ ...newTag, is_trigger: e.target.checked })} /> Trg
            </label>
          </div>
          <button className="btn ok text-sm shrink-0" onClick={addTag}>Agregar tag</button>
        </div>
      </div>

      {/* Columna derecha: SQL + Actualizaciones + Export/Import */}
      <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
        <div className="card p-3 space-y-2 shrink-0">
          <h2 className="font-semibold text-purple-400 text-sm">SQL Server (auditoría)</h2>
          <div className="grid grid-cols-2 gap-2">
            {field('sql_server', 'Servidor SQL')}
            {field('sql_database', 'Base de datos')}
            {field('sql_user', 'Usuario SQL')}
            {field('sql_password', 'Contraseña SQL', 'password')}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn ok text-sm" onClick={() => saveCfg(['sql_server', 'sql_database', 'sql_user', 'sql_password'])}>Guardar SQL</button>
            <button className="btn ghost text-sm" onClick={ensureTable}>Crear tabla</button>
            <button className="btn ghost text-sm" onClick={syncNow} disabled={syncing}>{syncing ? 'Sincronizando…' : 'Sincronizar'}</button>
          </div>
          {tableStatus && (
            <div className="text-xs text-[var(--text-muted)]">
              Conexión: {tableStatus.connected ? '✓ OK' : '✗ Sin conexión'} · Tabla: {tableStatus.table_exists ? '✓ Existe' : '✗ No existe'}
            </div>
          )}
        </div>

        <div className="card p-3 space-y-2 shrink-0">
          <h2 className="font-semibold text-sm">Actualizaciones</h2>
          <div className="text-xs text-[var(--text-muted)]">Versión actual: <span className="font-mono">{appVersion || '1.0.0'}</span></div>
          <div className="flex gap-2">
            <button className="btn ok text-sm" disabled={checking} onClick={async () => {
              setChecking(true);
              setUpdateStatus('Buscando actualizaciones…');
              try {
                const update = await check();
                if (update) {
                  setUpdateStatus(`Nueva versión ${update.version}. Descargando…`);
                  await update.downloadAndInstall();
                  setUpdateStatus('Instalada. Reiniciando…');
                  await relaunch();
                } else {
                  setUpdateStatus('Ya tienes la última versión.');
                }
              } catch (e: any) {
                setUpdateStatus('Error: ' + (e?.message || e));
              } finally {
                setChecking(false);
              }
            }}>{checking ? 'Buscando…' : 'Buscar actualizaciones'}</button>
          </div>
          {updateStatus && <div className="text-xs text-[var(--text-muted)]">{updateStatus}</div>}
        </div>

        <div className="card p-3 space-y-2 flex-1 min-h-0 overflow-hidden">
          <h2 className="font-semibold text-sm">Exportar / Importar configuración</h2>
          <p className="text-xs text-[var(--text-muted)]">Guarda toda la configuración en un JSON para respaldo o mover a otra PC.</p>
          <div className="flex gap-2">
            <button className="btn ok text-sm" onClick={async () => {
              try {
                const data = await api.get('/config/export');
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url; a.download = 'etiquetaunibody-config.json'; a.click();
                URL.revokeObjectURL(url);
              } catch (e: any) { alert('Error: ' + (e?.message || e)); }
            }}>Exportar</button>
            <label className="btn ghost text-sm cursor-pointer">
              Importar
              <input type="file" accept="application/json" className="hidden" onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const text = await f.text();
                  const data = JSON.parse(text);
                  await api.post('/config/import', data);
                  alert('Configuración importada. Recarga la página.');
                  load();
                } catch (err: any) { alert('Error: ' + (err?.message || err)); }
                e.target.value = '';
              }} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
