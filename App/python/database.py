"""DB dual: SQLite local (config/tags/templates) + SQL Server remoto (auditoría)."""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

def _writable_base():
    appdata = os.getenv("APPDATA") or os.path.expanduser("~")
    base_dir = os.path.join(appdata, "EtiquetaUniBody")
    os.makedirs(base_dir, exist_ok=True)
    return base_dir

def get_database_url(which="local"):
    if which == "remote":
        server = os.getenv("SQL_SERVER", "192.168.1.200")
        db = os.getenv("SQL_DATABASE", "Insight")
        user = os.getenv("SQL_USER", "")
        pwd = os.getenv("SQL_PASSWORD", "")
        driver = os.getenv("MSSQL_DRIVER", "ODBC Driver 17 for SQL Server")
        if user:
            return f"mssql+pyodbc://{user}:{pwd}@{server}/{db}?driver={driver.replace(' ', '+')}"
        return f"mssql+pyodbc://@{server}/{db}?driver={driver.replace(' ', '+')}&trusted_connection=yes"
    if os.getenv("DATABASE_URL"):
        return os.getenv("DATABASE_URL")
    return f"sqlite:///{os.path.join(_writable_base(), 'etiqueta_unibody.db')}"

class DatabaseManager:
    def __init__(self, url=None):
        self.url = url or get_database_url("local")
        connect_args = {"check_same_thread": False} if self.url.startswith("sqlite") else {"timeout": 5}
        self.engine = create_engine(self.url, pool_pre_ping=True, connect_args=connect_args)
        self.Session = sessionmaker(bind=self.engine)

    def create_tables(self):
        from .models import Base, DEFAULT_CONFIGS, Configuration
        Base.metadata.create_all(self.engine)
        s = self.Session()
        try:
            for k, v in DEFAULT_CONFIGS:
                if not s.query(Configuration).filter_by(config_key=k).first():
                    s.add(Configuration(config_key=k, config_value=v))
            s.commit()
        except Exception:
            s.rollback()
        finally:
            s.close()

    def test_connection(self):
        try:
            with self.engine.connect() as c:
                c.execute(text("SELECT 1"))
            return True
        except Exception as e:
            return False

local_db = DatabaseManager(get_database_url("local"))

def get_remote_db(server=None, database=None, user=None, password=None):
    if server:
        os.environ["SQL_SERVER"] = server
    if database:
        os.environ["SQL_DATABASE"] = database
    if user is not None:
        os.environ["SQL_USER"] = user
    if password is not None:
        os.environ["SQL_PASSWORD"] = password
    return DatabaseManager(get_database_url("remote"))
