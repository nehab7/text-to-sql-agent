import operator
from typing import TypedDict, Annotated, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_community.utilities import SQLDatabase
from sqlalchemy import text
from database import engine
from langgraph.checkpoint.memory import MemorySaver

db = SQLDatabase(engine)
llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)

class AgentState(TypedDict):
    query: str
    sql_query: str
    sql_error: str
    retry_count: int
    results: List[Dict[str, Any]]
    explanation: str
    status: str

def generate_sql(state: AgentState):
    query = state["query"]
    error = state.get("sql_error")
    
    schema = db.get_table_info()
    
    prompt = f"""You are an expert SQLite developer. Given an input question, create a syntactically correct SQLite query to run.
Do NOT wrap the query in ```sql blocks, just return the raw query text.

Schema:
{schema}

Question: {query}
"""
    if error:
        prompt += f"\nYour previous query failed with this error: {error}. Please correct it."
    
    response = llm.invoke([HumanMessage(content=prompt)])
    # Clean up just in case
    sql = response.content.replace("```sql", "").replace("```", "").strip()
    return {"sql_query": sql, "sql_error": "", "status": "pending_approval"}

def execute_sql(state: AgentState):
    sql = state["sql_query"]
    try:
        with engine.connect() as conn:
            result = conn.execute(text(sql))
            keys = result.keys()
            res_list = [dict(zip(keys, row)) for row in result.fetchall()]
        return {"results": res_list, "sql_error": "", "status": "executed"}
    except Exception as e:
        return {"sql_error": str(e), "retry_count": state.get("retry_count", 0) + 1}

def generate_explanation(state: AgentState):
    query = state["query"]
    sql = state["sql_query"]
    results = state.get("results", [])
    
    # Only send a snippet of results to save tokens
    results_snippet = results[:10] if len(results) > 10 else results
    
    prompt = f"Question: {query}\nSQL: {sql}\nResults (first 10 rows): {results_snippet}\n\nExplain the results in plain English simply and concisely. Address the user directly."
    response = llm.invoke([HumanMessage(content=prompt)])
    
    return {"explanation": response.content, "status": "completed"}

def router(state: AgentState):
    if state.get("sql_error"):
        if state.get("retry_count", 0) < 3:
            return "generate_sql" # Self-heal
        else:
            return "end" # Give up
    return "generate_explanation" # Success, explain it

workflow = StateGraph(AgentState)

workflow.add_node("generate_sql", generate_sql)
workflow.add_node("execute_sql", execute_sql)
workflow.add_node("generate_explanation", generate_explanation)

workflow.set_entry_point("generate_sql")
workflow.add_edge("generate_sql", "execute_sql")
workflow.add_conditional_edges("execute_sql", router, {
    "generate_sql": "generate_sql",
    "generate_explanation": "generate_explanation",
    "end": END
})
workflow.add_edge("generate_explanation", END)

memory = MemorySaver()
app_graph = workflow.compile(checkpointer=memory, interrupt_before=["execute_sql"])

def process_query(query: str, thread_id: str):
    config = {"configurable": {"thread_id": thread_id}}
    state = app_graph.invoke({"query": query, "retry_count": 0}, config)
    return {
        "sql_query": state.get("sql_query"),
        "status": state.get("status")
    }

def execute_approved_sql(thread_id: str, approve: bool):
    config = {"configurable": {"thread_id": thread_id}}
    if approve:
        # Resume the graph (this executes `execute_sql` and then `generate_explanation` or loops back if error)
        state = app_graph.invoke(None, config)
        return {
            "sql_query": state.get("sql_query"),
            "results": state.get("results"),
            "explanation": state.get("explanation"),
            "status": state.get("status"),
            "retry_count": state.get("retry_count", 0)
        }
    else:
        return {"status": "rejected"}
