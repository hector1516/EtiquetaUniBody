import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Settings() {
  const [cfg, setCfg] = useState<any>({});
  const [tags, setTags] = useState<any[]>([]);
  const [newTag, setNewTag] = useState({ name: '', tag_name: '', data_type: 'DINT', app_variable: 'CUSTOM', is_trigger: false });

  const load = async () => {
    try { setCfg(await api.get('/config')); } catch {}
    try { setTags(await api.get('/plc/tags')); } catch {}
  };
  useEffect(() => { load(); }, []);

  const saveCfg = async () => {
    try { await api.post('/config', { values: cfg }); alert('Configuración guardada'); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };
  const addTag = async () => {
    try { await api.post('/plc/tags', newTag); setNewTag({ name: '', tag_name: '', data_type: 'DINT', app_variable: 'CUSTOM', is_trigger: false }); load(); }
    catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };
  const delTag = async (id: number) => {
    try { await api.del(`/plc/tags/${id}`); load(); } catch {}
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
        <h2 className="font-semibold">Conectividad</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {field('plc_ip', 'IP del PLC (Allen-Bradley)')}
          {field('plc_slot', 'Slot del procesador', 'number')}
          {field('printer_ip', 'IP Impresora Zebra')}
          {field('printer_port', 'Puerto impresora', 'number')}
          {field('sql_server', 'Servidor SQL Server')}
          {field('sql_database', 'Base de datos SQL')}
          {field('sql_user', 'Usuario SQL')}
          {field('sql_password', 'Contraseña SQL', 'password')}
        </div>
        <button className="btn ok" onClick={saveCfg}>Guardar</button>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="font-semibold">Tags del PLC</h2>
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
    </div>
  );
}
