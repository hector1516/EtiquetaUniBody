"""EtiquetaUniBody backend - FastAPI."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import local_db
from .logger import logger
from .routes.api import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    local_db.create_tables()
    # seed default label template if none
    from .database import local_db as ldb
    from .models import LabelTemplate
    s = ldb.Session()
    try:
        if not s.query(LabelTemplate).first():
            default_canvas = '{"label":{"width_mm":100,"height_mm":60,"bg_color":"#FFFFFF"},"objects":[{"id":"t1","type":"text","x":40,"y":30,"content":"ETIQUETA UNIBODY","font_size":28},{"id":"t2","type":"text","x":40,"y":70,"content":"Serie: {SERIAL}","font_size":18},{"id":"t3","type":"text","x":40,"y":100,"content":"Lote: {BATCH}","font_size":18},{"id":"bc1","type":"barcode","x":40,"y":140,"data_source":"{SERIAL}","height":80}]}'
            s.add(LabelTemplate(name="Predeterminada 100x60", width_mm=100, height_mm=60,
                                canvas_data=default_canvas, is_default=True))
            s.commit()
    except Exception as e:
        print("[seed]", e)
        s.rollback()
    finally:
        s.close()
    # ensure audit table (best-effort, non-blocking)
    import threading
    def _ensure():
        try:
            from .routes.api import _ensure_audit_table
            _ensure_audit_table()
        except Exception as e:
            print("[audit]", e)
    threading.Thread(target=_ensure, daemon=True).start()
    # auto-start trigger monitor
    try:
        from .routes.api import start_monitor
        start_monitor()
    except Exception as e:
        print("[monitor]", e)
    logger.info("EtiquetaUniBody backend iniciado")
    yield

app = FastAPI(title="EtiquetaUniBody API", version="1.0.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])
app.include_router(router)

@app.get("/")
def root():
    return {"message": "EtiquetaUniBody API running", "version": "1.0.0"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("App.python.main:app", host="127.0.0.1", port=8000, reload=True)
