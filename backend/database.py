import os
import urllib.request
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DB_FILE = "chinook.db"
DB_URL = "https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_Sqlite.sqlite"

def download_db_if_needed():
    if not os.path.exists(DB_FILE):
        print("Downloading Chinook database...")
        urllib.request.urlretrieve(DB_URL, DB_FILE)
        print("Downloaded.")

download_db_if_needed()

engine = create_engine(f"sqlite:///{DB_FILE}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
