"""Generador de ZPL a partir del diseño de canvas y variables dinámicas."""
import json
import re

DPI_DOTS_PER_MM = 8  # 203 dpi

def _scale(w_mm, h_mm):
    canvas_w = 560.0
    canvas_h = 340.0
    sx = (w_mm * DPI_DOTS_PER_MM) / canvas_w
    sy = (h_mm * DPI_DOTS_PER_MM) / canvas_h
    return sx, sy

def substitute(text, ctx):
    if not isinstance(text, str):
        return text
    def repl(m):
        key = m.group(1).strip()
        if key in ctx:
            return str(ctx[key])
        # support nested keys like plc.SERIAL
        if "." in key:
            parts = key.split(".")
            cur = ctx
            for p in parts:
                if isinstance(cur, dict) and p in cur:
                    cur = cur[p]
                else:
                    return m.group(0)
            return str(cur)
        return m.group(0)
    return re.sub(r"\{([^}]+)\}", repl, text)

def canvas_to_zpl(canvas_data, ctx=None, w_mm=100, h_mm=60):
    ctx = ctx or {}
    try:
        t = json.loads(canvas_data) if isinstance(canvas_data, str) else canvas_data
    except Exception:
        t = {"objects": []}
    objs = t.get("objects", []) if isinstance(t, dict) else []
    label = t.get("label", {}) if isinstance(t, dict) else {}
    w_mm = label.get("width_mm", w_mm)
    h_mm = label.get("height_mm", h_mm)
    sx, sy = _scale(w_mm, h_mm)
    lines = []
    lines.append("^XA")
    # label size
    lines.append(f"^PW{int(w_mm*DPI_DOTS_PER_MM)}")
    lines.append(f"^LL{int(h_mm*DPI_DOTS_PER_MM)}")
    for o in objs:
        try:
            kind = o.get("type")
            x = int((o.get("x") or 0) * sx)
            y = int((o.get("y") or 0) * sy)
            if kind == "text":
                content = substitute(o.get("content", ""), ctx)
                fs = int((o.get("font_size") or 20) * sy)
                if fs < 10:
                    fs = 10
                # ^A0N,height,width
                lines.append(f"^FO{x},{y}^A0N,{fs},{int(fs*0.8)}^FD{content}^FS")
            elif kind == "rect":
                w = int((o.get("w") or 100) * sx)
                h = int((o.get("h") or 50) * sy)
                th = int(o.get("thickness") or 2)
                lines.append(f"^FO{x},{y}^GB{w},{h},{th}^FS")
            elif kind == "line":
                x2 = int((o.get("x2") or 0) * sx)
                y2 = int((o.get("y2") or 0) * sy)
                w = abs(x2 - x) or 1
                h = abs(y2 - y) or 1
                th = int(o.get("thickness") or 2)
                # draw as thin box
                if h == 1 or w == 1:
                    lines.append(f"^FO{min(x,x2)},{min(y,y2)}^GB{w},{h},{th}^FS")
                else:
                    lines.append(f"^FO{x},{y}^GB{w},{h},{th}^FS")
            elif kind == "barcode":
                data = substitute(o.get("data_source", ""), ctx)
                height = int((o.get("height") or 80) * sy)
                lines.append(f"^FO{x},{y}^BCN,{height},Y,N,N^FD{data}^FS")
            elif kind == "qrcode":
                data = substitute(o.get("data_source", ""), ctx)
                size = int((o.get("size") or 90) * sy / 3) or 3
                # ^BQ: magnification 1-10
                mag = max(1, min(10, size // 10 if size > 10 else 3))
                lines.append(f"^FO{x},{y}^BQN,2,{mag}^FDMA,{data}^FS")
            elif kind == "datamatrix":
                data = substitute(o.get("data_source", ""), ctx)
                lines.append(f"^FO{x},{y}^BXN,4,200^FD{data}^FS")
        except Exception:
            continue
    lines.append("^XZ")
    return "\n".join(lines)

def build_context(plc_vars=None, system_vars=None, custom=None):
    ctx = {}
    if system_vars:
        ctx.update(system_vars)
    if plc_vars:
        ctx["plc"] = plc_vars
        # flatten common
        for k, v in plc_vars.items():
            if isinstance(v, dict):
                ctx[k] = v.get("value", v)
            else:
                ctx[k] = v
    if custom:
        ctx.update(custom)
    # convenience aliases
    now = __import__("datetime").datetime.now()
    ctx.setdefault("FECHA", now.strftime("%Y-%m-%d"))
    ctx.setdefault("HORA", now.strftime("%H:%M:%S"))
    ctx.setdefault("FECHA_HORA", now.strftime("%Y-%m-%d %H:%M:%S"))
    return ctx
