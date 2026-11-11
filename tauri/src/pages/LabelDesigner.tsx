import { useEffect, useState } from 'react';
import { api } from '../api';
import { LabelEditor, objsToCanvas, canvasToObjs } from '../components/LabelEditor';

export default function LabelDesigner() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [name, setName] = useState('Nueva plantilla');
  const [wMm, setWMm] = useState(100);
  const [hMm, setHMm] = useState(60);
  const [objs, setObjs] = useState<any[]>([]);
  const [zpl, setZpl] = useState('');
  const [previewCtx, setPreviewCtx] = useState({ SERIAL: 'ABC123', BATCH: 'L001' });

  const load = async () => {
    try {
      const t = await api.get('/labels/templates');
      setTemplates(t);
      if (t.length && selectedId === null) {
        const d = t.find((x: any) => x.is_default) || t[0];
        selectTemplate(d);
      }
    } catch {}
  };
  useEffect(() => { load(); }, []);

  const selectTemplate = (t: any) => {
    setSelectedId(t.id);
    setName(t.name);
    setWMm(t.width_mm);
    setHMm(t.height_mm);
    setObjs(canvasToObjs(t.canvas_data));
  };

  const handleSaveObjs = async (o: any[]) => {
    setObjs(o);
    const cd = objsToCanvas(o, wMm, hMm);
    try {
      const r = await api.post('/labels/templates', { id: selectedId, name, width_mm: wMm, height_mm: hMm, canvas_data: cd, is_default: true });
      setSelectedId(r.id);
      load();
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };

  const preview = async () => {
    const cd = objsToCanvas(objs, wMm, hMm);
    try {
      const r = await api.post('/labels/preview', { canvas_data: cd, context: previewCtx, width_mm: wMm, height_mm: hMm });
      setZpl(r.zpl);
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };

  const printTest = async () => {
    const cd = objsToCanvas(objs, wMm, hMm);
    try {
      const r = await api.post('/labels/print', { canvas_data: cd, context: previewCtx, width_mm: wMm, height_mm: hMm });
      alert(r.ok ? 'Impresión enviada' : 'Error: ' + r.error);
      setZpl(r.zpl);
    } catch (e: any) { alert('Error: ' + (e?.message || e)); }
  };

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-zinc-400">Plantilla</label>
          <select className="input" value={selectedId ?? ''} onChange={e => {
            const t = templates.find(x => x.id === Number(e.target.value));
            if (t) selectTemplate(t);
          }}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-400">Nombre</label>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Ancho (mm)</label>
          <input className="input" type="number" value={wMm} onChange={e => setWMm(Number(e.target.value))} />
        </div>
        <div>
          <label className="text-xs text-zinc-400">Alto (mm)</label>
          <input className="input" type="number" value={hMm} onChange={e => setHMm(Number(e.target.value))} />
        </div>
        <button className="btn ghost" onClick={() => { setSelectedId(null); setObjs([]); }}>Nueva</button>
      </div>

      <LabelEditor initial={objs} onSave={handleSaveObjs} />

      <div className="card p-4 space-y-3">
        <div className="flex gap-2">
          <button className="btn ghost" onClick={preview}>Previsualizar ZPL</button>
          <button className="btn ok" onClick={printTest}>Impresión de prueba</button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input className="input" value={previewCtx.SERIAL} onChange={e => setPreviewCtx({ ...previewCtx, SERIAL: e.target.value })} placeholder="SERIAL de prueba" />
          <input className="input" value={previewCtx.BATCH} onChange={e => setPreviewCtx({ ...previewCtx, BATCH: e.target.value })} placeholder="BATCH de prueba" />
        </div>
        {zpl && (
          <pre className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-300 overflow-auto max-h-64">{zpl}</pre>
        )}
      </div>
    </div>
  );
}
