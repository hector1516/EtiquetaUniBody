"""Modelos SQLAlchemy: configuración local (SQLite) + tablas de auditoría remota."""
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Float
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

# Configuración clave-valor local (SQLite)
DEFAULT_CONFIGS = [
    ("plc_ip", "192.168.1.10"),
    ("plc_rack", "0"),
    ("plc_slot", "1"),
    ("printer_ip", "192.168.1.50"),
    ("printer_port", "9100"),
    ("printer_dpi", "203"),
    ("sql_server", "192.168.1.200"),
    ("sql_database", "Insight"),
    ("sql_user", ""),
    ("sql_password", ""),
    ("trigger_tag", "Espumado_TriggerPrint"),
    ("label_width_mm", "100"),
    ("label_height_mm", "60"),
]

class Configuration(Base):
    __tablename__ = "configurations"
    id = Column(Integer, primary_key=True)
    config_key = Column(String(100), unique=True, nullable=False)
    config_value = Column(Text, default="")

class PlcTag(Base):
    __tablename__ = "plc_tags"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    tag_name = Column(String(200), nullable=False)
    data_type = Column(String(20), default="DINT")
    app_variable = Column(String(50), default="CUSTOM")
    is_trigger = Column(Boolean, default=False)

class LabelTemplate(Base):
    __tablename__ = "label_templates"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    width_mm = Column(Float, default=100.0)
    height_mm = Column(Float, default=60.0)
    canvas_data = Column(Text, default="{}")
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

# Auditoría local (SQLite) — offline-first: siempre se guarda aquí primero
class LocalAudit(Base):
    __tablename__ = "local_audit"
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    serial_num = Column(String(100))
    batch_id = Column(String(100))
    zpl_payload = Column(Text)
    status = Column(String(50))
    synced = Column(Boolean, default=False)   # True cuando ya se envió a SQL Server
    remote_id = Column(Integer, nullable=True)  # ID en SQL Server tras sync

# Tabla de auditoría remota (SQL Server)
AUDIT_TABLE_SQL = """
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Espumado_Etiquetas_Emitidas' AND xtype='U')
CREATE TABLE Espumado_Etiquetas_Emitidas (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Timestamp DATETIME NOT NULL DEFAULT GETDATE(),
    SerialNum NVARCHAR(100),
    BatchID NVARCHAR(100),
    ZPL_Payload NVARCHAR(MAX),
    Status NVARCHAR(50)
);
"""

def table_exists_sqlserver(engine, table_name="Espumado_Etiquetas_Emitidas"):
    try:
        with engine.connect() as c:
            r = c.execute(__import__("sqlalchemy").text(
                "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME=:t"), {"t": table_name}).fetchone()
            return r is not None
    except Exception:
        return False
