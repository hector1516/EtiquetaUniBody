"""Impresión ZPL directa vía socket TCP (puerto 9100) a impresora Zebra."""
import socket

def send_zpl(ip, port, zpl, timeout=5.0):
    try:
        with socket.create_connection((ip, int(port)), timeout=timeout) as s:
            s.sendall(zpl.encode("utf-8"))
        return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}

def test_printer(ip, port):
    zpl = "^XA^FO50,50^A0N,40,40^FDPRUEBA ETIQUETA UNIBODY^FS^XZ"
    return send_zpl(ip, port, zpl)
