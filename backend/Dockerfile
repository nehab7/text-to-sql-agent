FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run the database initialization to ensure SQLite is present
RUN python database.py

# Expose port 8000 for FastAPI
EXPOSE 8000

# Start Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
