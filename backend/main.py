import os
from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from agent import process_query, execute_approved_sql
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For Next.js frontend
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str
    thread_id: str

class ExecuteRequest(BaseModel):
    thread_id: str
    approve: bool

@app.post("/chat")
def chat(request: QueryRequest):
    result = process_query(request.query, request.thread_id)
    return result

@app.post("/execute")
def execute(request: ExecuteRequest):
    result = execute_approved_sql(request.thread_id, request.approve)
    return result
