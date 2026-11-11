"""PLC Allen-Bradley ControlLogix via pylogix (Ethernet/IP)."""
import time
import threading

try:
    from pylogix import PLC as _PLC
    HAS_PYLOGIX = True
except Exception:
    HAS_PYLOGIX = False


class PLCManager:
    def __init__(self, ip="192.168.1.10", slot=1, simulate=False):
        self.ip = ip
        self.slot = int(slot)
        self.simulate = simulate or not HAS_PYLOGIX
        self.connected = False
        self.client = None
        self._lock = threading.Lock()
        self._sim = {}
        self._last_attempt = 0

    def connect(self):
        if self.simulate:
            self.connected = True
            return True
        if not HAS_PYLOGIX:
            self.connected = False
            return False
        now = time.time()
        if not self.connected and (now - self._last_attempt < 2.0):
            return False
        self._last_attempt = now
        try:
            if self.client is not None:
                try:
                    self.client.Close()
                except Exception:
                    pass
            self.client = _PLC()
            self.client.IPAddress = self.ip
            self.client.ProcessorSlot = self.slot
            self.connected = True
            return True
        except Exception as e:
            self.connected = False
            self.client = None
            return False

    def ensure_connected(self):
        if not self.simulate and not self.connected:
            self.connect()

    def disconnect(self):
        if self.client is not None and not self.simulate:
            try:
                self.client.Close()
            except Exception:
                pass
        self.client = None
        self.connected = False

    def update_config(self, ip, slot=1, simulate=False):
        self.ip = ip
        self.slot = int(slot)
        self.simulate = simulate or not HAS_PYLOGIX
        self._last_attempt = 0
        if self.connected:
            self.disconnect()
        self.connect()

    def read_tag(self, tag_name):
        if self.simulate:
            return self._sim.get(tag_name, 0)
        self.ensure_connected()
        if not self.connected or self.client is None:
            return None
        try:
            with self._lock:
                r = self.client.Read(tag_name)
            if hasattr(r, "Status") and r.Status != "Success":
                return None
            return getattr(r, "Value", None)
        except Exception:
            self.connected = False
            return None

    def write_tag(self, tag_name, value):
        if self.simulate:
            self._sim[tag_name] = value
            return True
        self.ensure_connected()
        if not self.connected or self.client is None:
            return False
        try:
            with self._lock:
                r = self.client.Write(tag_name, value)
            return getattr(r, "Status", "Error") == "Success"
        except Exception:
            self.connected = False
            return False

    def read_tags(self, tag_names):
        out = {}
        for t in tag_names:
            out[t] = self.read_tag(t)
        return out

    def test_connection(self):
        if self.simulate:
            return self.connected
        self.ensure_connected()
        if not self.connected:
            return False
        try:
            with self._lock:
                # read a standard tag if exists; otherwise just check socket
                self.client.GetTagList()
            return True
        except Exception:
            return self.connected

    def read_mapped_tags(self, tags_list):
        """tags_list: list of dicts/objects with name, tag_name, data_type, app_variable, is_trigger"""
        out = {}
        for t in tags_list:
            def g(key, default=None):
                if isinstance(t, dict):
                    return t.get(key, default)
                return getattr(t, key, default)
            app_var = g("app_variable", "CUSTOM")
            if not app_var or app_var == "CUSTOM":
                # still read custom tags? skip for trigger mapping; but keep in separate
                pass
            tag_name = g("tag_name")
            val = self.read_tag(tag_name) if tag_name else None
            entry = {
                "id": g("id"),
                "name": g("name"),
                "tag_name": tag_name,
                "data_type": g("data_type", "DINT"),
                "app_variable": app_var,
                "is_trigger": bool(g("is_trigger", False)),
                "value": val,
            }
            out[str(g("id"))] = entry
            if app_var and app_var != "CUSTOM":
                out.setdefault("_vars", {})[app_var] = val
        return out
