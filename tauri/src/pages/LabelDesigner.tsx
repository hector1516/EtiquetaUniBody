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
  const [plcTags, setPlcTags] = useState<any>(null);

  const loadPlcTags = async () => {
    try { setPlcTags(await api.get('/plc/read')); } catch {}
  };

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
  useEffect(() => { load(); loadPlcTags(); const id = setInterval(loadPlcTags, 3000); return () => clearInterval(id); }, []);

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
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      <div className="card p-3 flex flex-wrap gap-2 items-end shrink-0">
        <div className="min-w-[140px]">
          <label className="text-xs text-[var(--text-muted)]">Plantilla</label>
          <select className="input text-sm" value={selectedId ?? ''} onChange={e => {
            const t = templates.find(x => x.id === Number(e.target.value));
            if (t) selectTemplate(t);
          }}>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="text-xs text-[var(--text-muted)]">Nombre</label>
          <input className="input text-sm" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="w-20">
          <label className="text-xs text-[var(--text-muted)]">Ancho</label>
          <input className="input text-sm" type="number" value={wMm} onChange={e => setWMm(Number(e.target.value))} />
        </div>
        <div className="w-20">
          <label className="text-xs text-[var(--text-muted)]">Alto</label>
          <input className="input text-sm" type="number" value={hMm} onChange={e => setHMm(Number(e.target.value))} />
        </div>
        <button className="btn ghost text-sm" onClick={() => { setSelectedId(null); setObjs([]); }}>Nueva</button>
      </div>

      <div className="flex-1 min-h-0 flex gap-3 overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto">
          <LabelEditor initial={objs} onSave={handleSaveObjs} />
        </div>
        <div className="w-72 shrink-0 flex flex-col gap-3 min-h-0 overflow-hidden">
          <div className="card p-3 space-y-2 flex-1 min-h-0 overflow-auto">
            <h3 className="font-semibold text-sm">Tags del PLC (en vivo)</h3>
            {plcTags ? (
              <div className="space-y-1">
                {Object.entries(plcTags).filter(([k]) => k !== '_vars').map(([k, v]: any) => (
                  <div key={k} className="flex items-center justify-between p-2 rounded bg-[var(--surface-2)] border border-[var(--border)]">
                    <div className="min-w-0">
                      <div className="text-xs text-[var(--text-muted)] truncate">{v.name}</div>
                      <div className="text-[10px] font-mono text-[var(--text-muted)] truncate">{v.tag_name}</div>
                    </div>
                    <div className="text-xs font-mono text-[var(--accent)] ml-2 shrink-0">{v.value === null ? '—' : String(v.value)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-[var(--text-muted)]">Cargando…</div>
            )}
          </div>
          <div className="card p-3 space-y-2 shrink-0">
            <div className="flex gap-2">
              <button className="btn ghost text-xs" onClick={preview}>Previsualizar ZPL</button>
              <button className="btn ok text-xs" onClick={printTest}>Impresión de prueba</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input className="input text-xs" value={previewCtx.SERIAL} onChange={e => setPreviewCtx({ ...previewCtx, SERIAL: e.target.value })} placeholder="SERIAL de prueba" />
              <input className="input text-xs" value={previewCtx.BATCH} onChange={e => setPreviewCtx({ ...previewCtx, BATCH: e.target.value })} placeholder="BATCH de prueba" />
            </div>
            {zpl && (
              <pre className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-2 text-[10px] text-[var(--text)] overflow-auto max-h-32">{zpl}</pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
