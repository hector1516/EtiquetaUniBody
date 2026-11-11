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
      <label className="text-xs text-zinc-400">{label}</label>
      <input className="input" type={type} value={cfg[key] ?? ''} onChange={e => setCfg({ ...cfg, [key]: e.target.value })} />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-emerald-400">PLC (Allen-Bradley ControlLogix)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('plc_ip', 'IP del PLC')}
          {field('plc_slot', 'Slot del procesador', 'number')}
        </div>
        <button className="btn ok" onClick={() => saveCfg(['plc_ip', 'plc_slot'])}>Guardar PLC</button>

        <h3 className="font-semibold mt-4">Tags del PLC</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-400 border-b border-zinc-700">
                <th className="text-left py-2">Alias</th>
                <th className="text-left py-2">Tag PLC</th>
                <th className="text-left py-2">Tipo</th>
                <th className="text-left py-2">Variable app</th>
                <th className="text-left py-2">Trigger</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tags.map(t => (
                <tr key={t.id} className="border-b border-zinc-800">
                  <td className="py-2">{t.name}</td>
                  <td className="py-2 font-mono text-xs">{t.tag_name}</td>
                  <td className="py-2">{t.data_type}</td>
                  <td className="py-2">{t.app_variable}</td>
                  <td className="py-2">{t.is_trigger ? '✓' : ''}</td>
                  <td className="py-2"><button className="btn danger text-xs px-2 py-1" onClick={() => delTag(t.id)}>✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input className="input" placeholder="Alias" value={newTag.name} onChange={e => setNewTag({ ...newTag, name: e.target.value })} />
          <input className="input" placeholder="Tag PLC" value={newTag.tag_name} onChange={e => setNewTag({ ...newTag, tag_name: e.target.value })} />
          <select className="input" value={newTag.data_type} onChange={e => setNewTag({ ...newTag, data_type: e.target.value })}>
            <option>BOOL</option><option>DINT</option><option>REAL</option><option>STRING</option>
          </select>
          <select className="input" value={newTag.app_variable} onChange={e => setNewTag({ ...newTag, app_variable: e.target.value })}>
            <option>CUSTOM</option><option>SERIAL</option><option>BATCH</option><option>TRIGGER</option>
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={newTag.is_trigger} onChange={e => setNewTag({ ...newTag, is_trigger: e.target.checked })} /> Trigger
          </label>
        </div>
        <button className="btn ok" onClick={addTag}>Agregar tag</button>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-blue-400">Impresora Zebra (ZPL)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('printer_ip', 'IP de la impresora')}
          {field('printer_port', 'Puerto', 'number')}
        </div>
        <button className="btn ok" onClick={() => saveCfg(['printer_ip', 'printer_port'])}>Guardar impresora</button>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-purple-400">SQL Server (auditoría)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('sql_server', 'Servidor SQL')}
          {field('sql_database', 'Base de datos')}
          {field('sql_user', 'Usuario SQL')}
          {field('sql_password', 'Contraseña SQL', 'password')}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="btn ok" onClick={() => saveCfg(['sql_server', 'sql_database', 'sql_user', 'sql_password'])}>Guardar SQL</button>
          <button className="btn ghost" onClick={ensureTable}>Crear tabla en SQL Server</button>
          <button className="btn ghost" onClick={syncNow} disabled={syncing}>{syncing ? 'Sincronizando…' : 'Sincronizar pendientes'}</button>
        </div>
        {tableStatus && (
          <div className="text-xs text-zinc-400 mt-2">
            Conexión SQL: {tableStatus.connected ? '✓ OK' : '✗ Sin conexión'} · Tabla: {tableStatus.table_exists ? '✓ Existe' : '✗ No existe'}
            {tableStatus.error ? ` · ${tableStatus.error}` : ''}
          </div>
        )}
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-zinc-200">Actualizaciones</h2>
        <div className="text-xs text-zinc-400">Versión actual: <span className="font-mono text-zinc-200">{appVersion || '1.0.0'}</span></div>
        <div className="flex gap-2">
          <button className="btn ok" disabled={checking} onClick={async () => {
            setChecking(true);
            setUpdateStatus('Buscando actualizaciones…');
            try {
              const update = await check();
              if (update) {
                setUpdateStatus(`Nueva versión ${update.version} disponible. Descargando…`);
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
        {updateStatus && <div className="text-xs text-zinc-400">{updateStatus}</div>}
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold text-zinc-200">Exportar / Importar configuración</h2>
        <p className="text-xs text-zinc-400">Guarda toda la configuración (PLC, impresora, SQL, tags, plantillas) en un archivo JSON para respaldo o para mover a otra PC.</p>
        <div className="flex gap-2">
          <button className="btn ok" onClick={async () => {
            try {
              const data = await api.get('/config/export');
              const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = 'etiquetaunibody-config.json'; a.click();
              URL.revokeObjectURL(url);
            } catch (e: any) { alert('Error: ' + (e?.message || e)); }
          }}>Exportar configuración</button>
          <label className="btn ghost cursor-pointer">
            Importar configuración
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
  );
}
