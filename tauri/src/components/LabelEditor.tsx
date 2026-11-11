import { useState } from 'react';
import { Stage, Layer, Text, Rect, Line } from 'react-konva';

export type LObj =
  | { id: string; kind: 'text'; x: number; y: number; content: string; fontSize: number }
  | { id: string; kind: 'rect'; x: number; y: number; w: number; h: number; thickness?: number }
  | { id: string; kind: 'line'; x: number; y: number; x2: number; y2: number; thickness?: number }
  | { id: string; kind: 'barcode'; x: number; y: number; w: number; data: string; height?: number }
  | { id: string; kind: 'qr'; x: number; y: number; size: number; data: string };

const nid = () => `o${Date.now()}${Math.floor(Math.random() * 999)}`;

const PALETTE: { label: string; make: () => LObj }[] = [
  { label: 'Texto', make: () => ({ id: nid(), kind: 'text', x: 40, y: 30, content: 'TEXTO', fontSize: 28 }) },
  { label: 'Serie {SERIAL}', make: () => ({ id: nid(), kind: 'text', x: 40, y: 70, content: 'Serie: {SERIAL}', fontSize: 18 }) },
  { label: 'Lote {BATCH}', make: () => ({ id: nid(), kind: 'text', x: 40, y: 100, content: 'Lote: {BATCH}', fontSize: 18 }) },
  { label: 'Fecha', make: () => ({ id: nid(), kind: 'text', x: 40, y: 130, content: 'Fecha: {FECHA}', fontSize: 16 }) },
  { label: 'Barcode', make: () => ({ id: nid(), kind: 'barcode', x: 40, y: 160, w: 300, data: '{SERIAL}', height: 80 }) },
  { label: 'QR', make: () => ({ id: nid(), kind: 'qr', x: 400, y: 240, size: 90, data: '{SERIAL}|{BATCH}' }) },
  { label: 'Línea', make: () => ({ id: nid(), kind: 'line', x: 40, y: 230, x2: 520, y2: 230 }) },
  { label: 'Marco', make: () => ({ id: nid(), kind: 'rect', x: 20, y: 20, w: 520, h: 300 }) },
];

export function objsToCanvas(objs: LObj[], wMm = 100, hMm = 60): string {
  return JSON.stringify({
    label: { width_mm: wMm, height_mm: hMm, bg_color: '#FFFFFF' },
    objects: objs.map(o => {
      if (o.kind === 'text') return { id: o.id, type: 'text', x: o.x, y: o.y, content: o.content, font_size: o.fontSize };
      if (o.kind === 'rect') return { id: o.id, type: 'rect', x: o.x, y: o.y, w: o.w, h: o.h, thickness: o.thickness ?? 2 };
      if (o.kind === 'line') return { id: o.id, type: 'line', x: o.x, y: o.y, x2: o.x2, y2: o.y2, thickness: o.thickness ?? 2 };
      if (o.kind === 'barcode') return { id: o.id, type: 'barcode', x: o.x, y: o.y, data_source: o.data, height: o.height ?? 80 };
      return { id: o.id, type: 'qrcode', x: o.x, y: o.y, size: o.size, data_source: o.data };
    }),
  });
}

export function canvasToObjs(canvasData: string): LObj[] {
  try {
    const t = JSON.parse(canvasData);
    return (t.objects ?? []).map((o: any, i: number): LObj => {
      const id = o.id ?? `o${i}`;
      if (o.type === 'rect') return { id, kind: 'rect', x: o.x ?? 0, y: o.y ?? 0, w: o.w ?? 200, h: o.h ?? 80, thickness: o.thickness };
      if (o.type === 'line') return { id, kind: 'line', x: o.x ?? 0, y: o.y ?? 0, x2: o.x2 ?? 200, y2: o.y2 ?? 0, thickness: o.thickness };
      if (o.type === 'barcode') return { id, kind: 'barcode', x: o.x ?? 0, y: o.y ?? 0, w: 300, data: o.data_source ?? '', height: o.height };
      if (o.type === 'qrcode') return { id, kind: 'qr', x: o.x ?? 0, y: o.y ?? 0, size: o.size ?? 90, data: o.data_source ?? '' };
      return { id, kind: 'text', x: o.x ?? 0, y: o.y ?? 0, content: o.content ?? '', fontSize: o.font_size ?? 20 };
    });
  } catch { return []; }
}

export function LabelEditor({ initial, onSave }: { initial?: LObj[]; onSave: (objs: LObj[]) => void; }) {
  const [objs, setObjs] = useState<LObj[]>(initial ?? []);
  const [past, setPast] = useState<LObj[][]>([]);
  const [future, setFuture] = useState<LObj[][]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const commit = (next: LObj[]) => { setPast(p => [...p.slice(-29), objs]); setFuture([]); setObjs(next); };
  const undo = () => { if (!past.length) return; setFuture(f => [objs, ...f]); const prev = past[past.length - 1]; setPast(p => p.slice(0, -1)); setObjs(prev); };
  const redo = () => { if (!future.length) return; setPast(p => [...p, objs]); const [next, ...rest] = future; setFuture(rest); setObjs(next); };
  const move = (id: string, x: number, y: number) => setObjs(os => os.map(o => o.id === id ? { ...o, x: Math.round(x), y: Math.round(y) } as LObj : o));
  const selected = objs.find(o => o.id === sel) ?? null;
  const num = (v: string, fb: number) => { const n = Number(v); return Number.isFinite(n) ? n : fb; };

  return (
    <div className="flex gap-4 items-start">
      <div className="w-44 shrink-0 space-y-2">
        <div className="text-sm font-semibold text-zinc-300">Paleta</div>
        {PALETTE.map(p => (
          <button key={p.label} className="btn ghost w-full text-sm" onClick={() => { const o = p.make(); commit([...objs, o]); setSel(o.id); }}>
            {p.label}
          </button>
        ))}
        <div className="flex gap-2 mt-2">
          <button className="btn ghost flex-1" disabled={!past.length} onClick={undo}>↩</button>
          <button className="btn ghost flex-1" disabled={!future.length} onClick={redo}>↪</button>
        </div>
        <div className="flex gap-2 items-center mt-2">
          <button className="btn ghost flex-1" onClick={() => setZoom(z => Math.max(.5, +(z - .25).toFixed(2)))}>−</button>
          <span className="text-xs text-zinc-400">{Math.round(zoom * 100)}%</span>
          <button className="btn ghost flex-1" onClick={() => setZoom(z => Math.min(2, +(z + .25).toFixed(2)))}>+</button>
        </div>
      </div>

      <div className="bg-white border-2 border-zinc-700 rounded-lg overflow-auto">
        <Stage width={560 * zoom} height={340 * zoom} scaleX={zoom} scaleY={zoom}
          onMouseDown={e => { if (e.target === e.target.getStage()) setSel(null); }}>
          <Layer>
            {objs.map(o => {
              const common: any = { key: o.id, draggable: true, onClick: () => setSel(o.id), onDragEnd: (e: any) => move(o.id, e.target.x(), e.target.y()) };
              const hl = sel === o.id ? '#10b981' : undefined;
              if (o.kind === 'text') return <Text {...common} x={o.x} y={o.y} text={o.content} fontSize={o.fontSize} stroke={hl} strokeWidth={hl ? 1 : 0} fill="#000" />;
              if (o.kind === 'rect') return <Rect {...common} x={o.x} y={o.y} width={o.w} height={o.h} stroke={hl ?? '#000'} strokeWidth={2} />;
              if (o.kind === 'line') return <Line {...common} points={[o.x, o.y, o.x2, o.y2]} stroke={hl ?? '#000'} strokeWidth={3} />;
              if (o.kind === 'barcode') return <Rect {...common} x={o.x} y={o.y} width={o.w} height={70} fill="#fff" stroke={hl ?? '#000'} strokeWidth={2} />;
              return <Rect {...common} x={o.x} y={o.y} width={o.size} height={o.size} fill="#eee" stroke={hl ?? '#000'} strokeWidth={2} />;
            })}
          </Layer>
        </Stage>
        <div className="p-2 text-xs text-zinc-500">{objs.length} objetos · click para seleccionar · arrastra para mover</div>
      </div>

      <div className="card p-4 w-72 shrink-0 space-y-3">
        <h3 className="font-semibold text-zinc-200">Propiedades</h3>
        {!selected && <div className="text-sm text-zinc-500">Selecciona un objeto del canvas.</div>}
        {selected?.kind === 'text' && (
          <>
            <label className="text-xs text-zinc-400">Contenido</label>
            <input className="input" value={selected.content} onChange={e => setObjs(os => os.map(x => x.id === sel ? { ...x, content: e.target.value } as LObj : x))} />
            <label className="text-xs text-zinc-400">Tamaño</label>
            <input className="input" type="number" value={selected.fontSize} onChange={e => setObjs(os => os.map(x => x.id === sel ? { ...x, fontSize: num(e.target.value, 20) } as LObj : x))} />
          </>
        )}
        {(selected?.kind === 'barcode' || selected?.kind === 'qr') && (
          <>
            <label className="text-xs text-zinc-400">Datos</label>
            <input className="input" value={selected.data} onChange={e => setObjs(os => os.map(x => x.id === sel ? { ...x, data: e.target.value } as LObj : x))} />
            {selected.kind === 'barcode' && (<>
              <label className="text-xs text-zinc-400">Ancho</label>
              <input className="input" type="number" value={selected.w} onChange={e => setObjs(os => os.map(x => x.id === sel ? { ...x, w: num(e.target.value, 300) } as LObj : x))} />
            </>)}
            {selected.kind === 'qr' && (<>
              <label className="text-xs text-zinc-400">Tamaño</label>
              <input className="input" type="number" value={selected.size} onChange={e => setObjs(os => os.map(x => x.id === sel ? { ...x, size: num(e.target.value, 90) } as LObj : x))} />
            </>)}
          </>
        )}
        {selected && (
          <div className="flex gap-2">
            <button className="btn ghost flex-1 text-sm" onClick={() => { const c = { ...selected, id: nid() } as LObj; const n = { ...c, x: (c as any).x + 20, y: (c as any).y + 20 } as LObj; commit([...objs, n]); setSel(n.id); }}>Duplicar</button>
            <button className="btn danger flex-1 text-sm" onClick={() => { commit(objs.filter(x => x.id !== sel)); setSel(null); }}>Eliminar</button>
          </div>
        )}
        <button className="btn ok w-full" onClick={() => onSave(objs)}>Guardar diseño</button>
      </div>
    </div>
  );
}
