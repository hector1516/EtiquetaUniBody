"""API REST del backend EtiquetaUniBody."""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Any
import threading
import time
import os

router = APIRouter()

# ---------- estado global ----------
_plc_instance = None
_poll_thread = None
_poll_stop = threading.Event()
_recent_events = []   # lista de eventos de trigger
_event_lock = threading.Lock()
_last_trigger_state = {"value": None}

def _cfg_get(key, default=""):
    from ..database import local_db
    from ..models import Configuration
    s = local_db.Session()
    try:
        c = s.query(Configuration).filter_by(config_key=key).first()
        return c.config_value if c else default
    finally:
        s.close()

def _cfg_set(key, value):
    from ..database import local_db
    from ..models import Configuration
    s = local_db.Session()
    try:
        c = s.query(Configuration).filter_by(config_key=key).first()
        if c:
            c.config_value = str(value)
        else:
            s.add(Configuration(config_key=key, config_value=str(value)))
        s.commit()
    except Exception:
        s.rollback()
    finally:
        s.close()

def _plc():
    global _plc_instance
    if _plc_instance is None:
        from ..plc_manager import PLCManager
        ip = _cfg_get("plc_ip", "192.168.1.10")
        slot = int(_cfg_get("plc_slot", "1") or 1)
        _plc_instance = PLCManager(ip=ip, slot=slot, simulate=True)
        _plc_instance.connect()
    return _plc_instance

def _remote_db():
    from ..database import get_remote_db
    return get_remote_db(
        server=_cfg_get("sql_server", "192.168.1.200"),
        database=_cfg_get("sql_database", "Insight"),
        user=_cfg_get("sql_user", ""),
        password=_cfg_get("sql_password", ""),
    )

def _ensure_audit_table():
    try:
        db = _remote_db()
        with db.engine.connect() as c:
            c.execute(__import__("sqlalchemy").text(__import__("App.python.models", fromlist=["AUDIT_TABLE_SQL"]).AUDIT_TABLE_SQL if False else
                "IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Espumado_Etiquetas_Emitidas' AND xtype='U') CREATE TABLE Espumado_Etiquetas_Emitidas (ID INT IDENTITY(1,1) PRIMARY KEY, Timestamp DATETIME NOT NULL DEFAULT GETDATE(), SerialNum NVARCHAR(100), BatchID NVARCHAR(100), ZPL_Payload NVARCHAR(MAX), Status NVARCHAR(50));"))
            c.commit()
    except Exception as e:
        print("[audit-table]", e)

# ---------- schemas ----------
class ConfigIn(BaseModel):
    values: dict

class PlcTagIn(BaseModel):
    id: Optional[int] = None
    name: str
    tag_name: str
    data_type: str = "DINT"
    app_variable: str = "CUSTOM"
    is_trigger: bool = False

class PlcConfigIn(BaseModel):
    ip: str
    slot: int = 1
    simulate: bool = True

class PrinterConfigIn(BaseModel):
    ip: str
    port: int = 9100

class PrintIn(BaseModel):
    zpl: str

class TemplateIn(BaseModel):
    id: Optional[int] = None
    name: str
    width_mm: float = 100.0
    height_mm: float = 60.0
    canvas_data: str = "{}"
    is_default: bool = False

class PreviewIn(BaseModel):
    canvas_data: str
    context: Optional[dict] = None
    width_mm: float = 100.0
    height_mm: float = 60.0

class PrintLabelIn(BaseModel):
    template_id: Optional[int] = None
    canvas_data: Optional[str] = None
    context: Optional[dict] = None
    width_mm: float = 100.0
    height_mm: float = 60.0

class ReprintIn(BaseModel):
    id: int

# ---------- config ----------
@router.get("/config")
def get_config():
    from ..database import local_db
    from ..models import Configuration
    s = local_db.Session()
    try:
        rows = s.query(Configuration).all()
        return {r.config_key: r.config_value for r in rows}
    finally:
        s.close()

@router.post("/config")
def set_config(body: ConfigIn):
    for k, v in body.values.items():
        _cfg_set(k, v)
    # propagate plc
    global _plc_instance
    if "plc_ip" in body.values or "plc_slot" in body.values:
        _plc_instance = None
    if "sql_server" in body.values:
        pass
    return {"ok": True}

# ---------- plc tags ----------
@router.get("/plc/tags")
def list_tags():
    from ..database import local_db
    from ..models import PlcTag
    s = local_db.Session()
    try:
        rows = s.query(PlcTag).all()
        return [{"id": r.id, "name": r.name, "tag_name": r.tag_name,
                 "data_type": r.data_type, "app_variable": r.app_variable,
                 "is_trigger": r.is_trigger} for r in rows]
    finally:
        s.close()

@router.post("/plc/tags")
def save_tag(body: PlcTagIn):
    from ..database import local_db
    from ..models import PlcTag
    s = local_db.Session()
    try:
        if body.id:
            r = s.query(PlcTag).filter_by(id=body.id).first()
            if not r:
                raise HTTPException(404, "tag no encontrado")
        else:
            r = PlcTag()
            s.add(r)
        r.name = body.name
        r.tag_name = body.tag_name
        r.data_type = body.data_type
        r.app_variable = body.app_variable
        r.is_trigger = body.is_trigger
        s.commit()
        return {"id": r.id}
    except HTTPException:
        raise
    except Exception as e:
        s.rollback()
        raise HTTPException(400, str(e))
    finally:
        s.close()

@router.delete("/plc/tags/{tag_id}")
def delete_tag(tag_id: int):
    from ..database import local_db
    from ..models import PlcTag
    s = local_db.Session()
    try:
        r = s.query(PlcTag).filter_by(id=tag_id).first()
        if not r:
            raise HTTPException(404, "tag no encontrado")
        s.delete(r)
        s.commit()
        return {"ok": True}
    finally:
        s.close()

@router.post("/plc/test")
def plc_test():
    p = _plc()
    # apply config
    p.update_config(_cfg_get("plc_ip", "192.168.1.10"), int(_cfg_get("plc_slot", "1") or 1), False)
    # if simulate forced? keep as is
    ok = p.test_connection()
    return {"connected": p.connected and ok, "ip": p.ip}

@router.get("/plc/status")
def plc_status():
    p = _plc()
    return {"connected": p.connected, "ip": p.ip, "simulate": p.simulate}

@router.get("/plc/read")
def plc_read():
    p = _plc()
    from ..database import local_db
    from ..models import PlcTag
    s = local_db.Session()
    try:
        tags = s.query(PlcTag).all()
        tag_list = [{"id": t.id, "name": t.name, "tag_name": t.tag_name,
                     "data_type": t.data_type, "app_variable": t.app_variable,
                     "is_trigger": t.is_trigger} for t in tags]
    finally:
        s.close()
    mapped = p.read_mapped_tags(tag_list)
    return mapped

@router.post("/plc/trigger-monitor/start")
def start_monitor():
    global _poll_thread
    if _poll_thread and _poll_thread.is_alive():
        return {"running": True}
    _poll_stop.clear()
    _poll_thread = threading.Thread(target=_poll_loop, daemon=True)
    _poll_thread.start()
    return {"running": True}

@router.post("/plc/trigger-monitor/stop")
def stop_monitor():
    _poll_stop.set()
    return {"running": False}

def _poll_loop():
    global _last_trigger_state
    while not _poll_stop.is_set():
        try:
            p = _plc()
            from ..database import local_db
            from ..models import PlcTag
            s = local_db.Session()
            try:
                tags = s.query(PlcTag).all()
                tag_list = [{"id": t.id, "name": t.name, "tag_name": t.tag_name,
                             "data_type": t.data_type, "app_variable": t.app_variable,
                             "is_trigger": t.is_trigger} for t in tags]
            finally:
                s.close()
            trigger_tags = [t for t in tag_list if t["is_trigger"]]
            # read trigger value
            for tt in trigger_tags:
                val = p.read_tag(tt["tag_name"])
                prev = _last_trigger_state.get(tt["id"])
                # rising edge detection: trigger when value becomes truthy from falsy/None
                if val is not None and val not in (0, False, "0", "") and not (prev not in (None,) and prev not in (0, False, "0", "")):
                    # rising edge
                    _handle_trigger(tt, tag_list, p)
                _last_trigger_state[tt["id"]] = val
        except Exception as e:
            print("[poll]", e)
        time.sleep(0.5)

def _handle_trigger(trigger_tag, tag_list, p):
    global _recent_events
    # read all mapped vars
    mapped = p.read_mapped_tags(tag_list)
    vars_flat = {}
    plc_vars = {}
    for k, v in mapped.items():
        if k == "_vars":
            continue
        if isinstance(v, dict):
            plc_vars[v.get("app_variable", v.get("name"))] = v
            if v.get("app_variable") and v["app_variable"] not in ("CUSTOM", None):
                vars_flat[v["app_variable"]] = v.get("value")
    # also include _vars
    if "_vars" in mapped:
        for k, v in mapped["_vars"].items():
            vars_flat[k] = v.get("value") if isinstance(v, dict) else v

    # build context
    from ..label_generator import build_context, canvas_to_zpl
    ctx = build_context(plc_vars=plc_vars, system_vars={})
    # flatten plc vars into ctx top-level for convenience
    for k, v in vars_flat.items():
        ctx.setdefault(k, v)

    # get default template
    from ..database import local_db
    from ..models import LabelTemplate
    s = local_db.Session()
    try:
        tmpl = s.query(LabelTemplate).filter_by(is_default=True).first()
        if not tmpl:
            tmpl = s.query(LabelTemplate).first()
        canvas_data = tmpl.canvas_data if tmpl else "{}"
        w_mm = tmpl.width_mm if tmpl else float(_cfg_get("label_width_mm", "100"))
        h_mm = tmpl.height_mm if tmpl else float(_cfg_get("label_height_mm", "60"))
    finally:
        s.close()

    zpl = canvas_to_zpl(canvas_data, ctx, w_mm, h_mm)

    # print
    from ..zpl_printer import send_zpl
    ip = _cfg_get("printer_ip", "192.168.1.50")
    port = int(_cfg_get("printer_port", "9100") or 9100)
    res = send_zpl(ip, port, zpl)

    # serial/batch from vars
    serial = vars_flat.get("SERIAL") or vars_flat.get("Serial_Number") or vars_flat.get("SerialNum")
    batch = vars_flat.get("BATCH") or vars_flat.get("Batch_ID") or vars_flat.get("BatchID")
    status = "OK" if res.get("ok") else f"ERROR: {res.get('error')}"

    # log to remote sql
    try:
        db = _remote_db()
        with db.engine.connect() as c:
            c.execute(__import__("sqlalchemy").text(
                "INSERT INTO Espumado_Etiquetas_Emitidas (SerialNum, BatchID, ZPL_Payload, Status) VALUES (:s, :b, :z, :st)"),
                {"s": str(serial) if serial is not None else None,
                 "b": str(batch) if batch is not None else None,
                 "z": zpl, "st": status})
            c.commit()
    except Exception as e:
        print("[audit-insert]", e)

    event = {
        "timestamp": __import__("datetime").datetime.now().isoformat(),
        "serial": serial, "batch": batch, "status": status,
        "zpl": zpl,
    }
    with _event_lock:
        _recent_events.append(event)
        if len(_recent_events) > 50:
            _recent_events = _recent_events[-50:]

@router.get("/trigger/events")
def get_events():
    with _event_lock:
        ev = list(_recent_events)
        _recent_events.clear()
    return ev

# ---------- printer ----------
@router.get("/printer/status")
def printer_status():
    return {"ip": _cfg_get("printer_ip", ""), "port": _cfg_get("printer_port", "9100")}

@router.post("/printer/test")
def printer_test():
    from ..zpl_printer import test_printer
    ip = _cfg_get("printer_ip", "192.168.1.50")
    port = int(_cfg_get("printer_port", "9100") or 9100)
    return test_printer(ip, port)

@router.post("/printer/print")
def printer_print(body: PrintIn):
    from ..zpl_printer import send_zpl
    ip = _cfg_get("printer_ip", "192.168.1.50")
    port = int(_cfg_get("printer_port", "9100") or 9100)
    return send_zpl(ip, port, body.zpl)

# ---------- templates ----------
@router.get("/labels/templates")
def list_templates():
    from ..database import local_db
    from ..models import LabelTemplate
    s = local_db.Session()
    try:
        rows = s.query(LabelTemplate).all()
        return [{"id": r.id, "name": r.name, "width_mm": r.width_mm,
                 "height_mm": r.height_mm, "canvas_data": r.canvas_data,
                 "is_default": r.is_default} for r in rows]
    finally:
        s.close()

@router.post("/labels/templates")
def save_template(body: TemplateIn):
    from ..database import local_db
    from ..models import LabelTemplate
    s = local_db.Session()
    try:
        if body.id:
            r = s.query(LabelTemplate).filter_by(id=body.id).first()
            if not r:
                raise HTTPException(404, "template no encontrado")
        else:
            r = LabelTemplate()
            s.add(r)
        r.name = body.name
        r.width_mm = body.width_mm
        r.height_mm = body.height_mm
        r.canvas_data = body.canvas_data
        r.is_default = body.is_default
        if body.is_default:
            for other in s.query(LabelTemplate).filter(LabelTemplate.id != r.id).all():
                other.is_default = False
        s.commit()
        return {"id": r.id}
    except HTTPException:
        raise
    except Exception as e:
        s.rollback()
        raise HTTPException(400, str(e))
    finally:
        s.close()

@router.delete("/labels/templates/{tid}")
def delete_template(tid: int):
    from ..database import local_db
    from ..models import LabelTemplate
    s = local_db.Session()
    try:
        r = s.query(LabelTemplate).filter_by(id=tid).first()
        if not r:
            raise HTTPException(404, "template no encontrado")
        s.delete(r)
        s.commit()
        return {"ok": True}
    finally:
        s.close()

@router.post("/labels/preview")
def preview_label(body: PreviewIn):
    from ..label_generator import canvas_to_zpl, build_context
    ctx = build_context(system_vars=body.context or {})
    zpl = canvas_to_zpl(body.canvas_data, ctx, body.width_mm, body.height_mm)
    return {"zpl": zpl}

@router.post("/labels/print")
def print_label(body: PrintLabelIn):
    from ..label_generator import canvas_to_zpl, build_context
    from ..zpl_printer import send_zpl
    canvas = body.canvas_data
    w_mm, h_mm = body.width_mm, body.height_mm
    if body.template_id:
        from ..database import local_db
        from ..models import LabelTemplate
        s = local_db.Session()
        try:
            t = s.query(LabelTemplate).filter_by(id=body.template_id).first()
            if t:
                canvas = t.canvas_data
                w_mm = t.width_mm
                h_mm = t.height_mm
        finally:
            s.close()
    ctx = build_context(system_vars=body.context or {})
    zpl = canvas_to_zpl(canvas or "{}", ctx, w_mm, h_mm)
    ip = _cfg_get("printer_ip", "192.168.1.50")
    port = int(_cfg_get("printer_port", "9100") or 9100)
    res = send_zpl(ip, port, zpl)
    return {"zpl": zpl, **res}

# ---------- audit / history ----------
@router.get("/audit")
def audit_list(limit: int = 100):
    try:
        db = _remote_db()
        with db.engine.connect() as c:
            rows = c.execute(__import__("sqlalchemy").text(
                "SELECT TOP (:lim) ID, Timestamp, SerialNum, BatchID, Status FROM Espumado_Etiquetas_Emitidas ORDER BY ID DESC"),
                {"lim": limit}).fetchall()
        out = []
        for r in rows:
            out.append({"id": r[0], "timestamp": str(r[1]), "serial": r[2],
                        "batch": r[3], "status": r[4]})
        return out
    except Exception as e:
        return {"error": str(e), "rows": []}

@router.get("/audit/{aid}")
def audit_get(aid: int):
    try:
        db = _remote_db()
        with db.engine.connect() as c:
            r = c.execute(__import__("sqlalchemy").text(
                "SELECT ID, Timestamp, SerialNum, BatchID, ZPL_Payload, Status FROM Espumado_Etiquetas_Emitidas WHERE ID=:id"),
                {"id": aid}).fetchone()
        if not r:
            raise HTTPException(404, "registro no encontrado")
        return {"id": r[0], "timestamp": str(r[1]), "serial": r[2],
                "batch": r[3], "zpl": r[4], "status": r[5]}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(400, str(e))

@router.post("/audit/reprint")
def audit_reprint(body: ReprintIn):
    from ..zpl_printer import send_zpl
    rec = audit_get(body.id)
    zpl = rec.get("zpl")
    if not zpl:
        raise HTTPException(400, "sin ZPL")
    ip = _cfg_get("printer_ip", "192.168.1.50")
    port = int(_cfg_get("printer_port", "9100") or 9100)
    res = send_zpl(ip, port, zpl)
    return {"zpl": zpl, **res}

@router.post("/audit/ensure-table")
def ensure_table():
    _ensure_audit_table()
    return {"ok": True}

@router.get("/health")
def health():
    return {"status": "ok"}
