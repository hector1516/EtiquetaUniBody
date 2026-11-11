"""Launcher del backend para PyInstaller onefile."""
import os
import sys
import time
import socket
import subprocess

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import uvicorn
from App.python.main import app

def free_port(port=8000):
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) == 0:
                mypid = os.getpid()
                ppid = os.getppid() if hasattr(os, 'getppid') else 0
                cmd = f'powershell -Command "Get-NetTCPConnection -LocalPort {port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object {{ if ($_.OwningProcess -ne {mypid} -and $_.OwningProcess -ne {ppid}) {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }} }}"'
                subprocess.run(cmd, shell=True, capture_output=True)
    except Exception:
        pass

def ensure_port_free(port=8000, timeout=5.0):
    free_port(port)
    start = time.time()
    while time.time() - start < timeout:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(('127.0.0.1', port)) != 0:
                return True
        time.sleep(0.4)
        free_port(port)
    return False

if __name__ == "__main__":
    ensure_port_free(8000)
    uvicorn.run(app, host="127.0.0.1", port=8000, workers=1, reload=False)
