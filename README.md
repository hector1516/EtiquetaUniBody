# EtiquetaUniBody

Espumado Insight - Generador e Impresor de Etiquetas.

Stack: Tauri v2 (React + Vite + TS + Tailwind) + Python sidecar (FastAPI) + pylogix (Allen-Bradley) + ZPL (Zebra) + SQL Server (pyodbc).

## Estructura
- `App/python` - backend FastAPI (pylogix, pyodbc, ZPL)
- `tauri` - frontend + Tauri shell
- `backend_entry.py` - launcher PyInstaller

## Desarrollo
Backend:
```
pip install -r requirements.txt
python backend_entry.py
```
Frontend:
```
cd tauri
npm install
npm run tauri dev
```

## Build sidecar
```
pyinstaller backend_entry.py --name etiqueta-backend --onefile --noconsole
```
Copiar el exe a `tauri/src-tauri/binaries/etiqueta-backend-x86_64-pc-windows-msvc.exe`.

## Build app
```
cd tauri
npm run tauri build
```
