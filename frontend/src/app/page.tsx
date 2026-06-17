"use client";

import { useState, useRef, useEffect } from "react";
import axios from "axios";
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Send, Check, X, Database, User, Bot, Copy, Code2 } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "agent";
  type: "text" | "sql_pending" | "sql_executed";
  content?: string;
  sql?: string;
  results?: any[];
  retryCount?: number;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "agent",
      type: "text",
      content: "Hello! I am your Text-to-SQL agent. I'm connected to the Chinook (Music Store) database. Ask me anything about artists, albums, tracks, or sales!"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [threadId, setThreadId] = useState(() => Math.random().toString(36).substring(7));
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: Message = { id: Date.now().toString(), role: "user", type: "text", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await axios.post(`${apiUrl}/chat`, {
        query: userMsg.content,
        thread_id: threadId
      });

      if (res.data.status === "pending_approval") {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: "agent",
          type: "sql_pending",
          sql: res.data.sql_query
        }]);
      } else {
        // Handled directly if for some reason it didn't pause
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "agent", type: "text", content: "Sorry, an error occurred." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (msgId: string, approve: boolean) => {
    setLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      const res = await axios.post(`${apiUrl}/execute`, {
        thread_id: threadId,
        approve: approve
      });

      setMessages(prev => prev.map(msg => {
        if (msg.id === msgId) {
          if (approve) {
            return {
              ...msg,
              type: "sql_executed",
              results: res.data.results,
              content: res.data.explanation,
              retryCount: res.data.retry_count
            };
          } else {
            return { ...msg, type: "text", content: "Query execution rejected." };
          }
        }
        return msg;
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex h-screen bg-neutral-950 text-neutral-100 font-sans">
      {/* Sidebar */}
      <div className="w-64 bg-neutral-900 border-r border-neutral-800 p-4 flex flex-col">
        <div className="flex items-center gap-2 text-xl font-bold mb-8 text-emerald-400">
          <Database size={24} />
          <span>SQL Agent</span>
        </div>
        <div className="text-sm text-neutral-400 uppercase tracking-wider mb-4 font-semibold">History</div>
        <div className="text-sm text-neutral-500 italic">No history yet.</div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'agent' && (
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Bot size={20} />
                </div>
              )}
              
              <div className={`space-y-4 max-w-[80%] ${msg.role === 'user' ? 'bg-emerald-600 text-white px-6 py-3 rounded-2xl rounded-tr-sm' : ''}`}>
                {msg.role === 'user' && <div className="text-sm">{msg.content}</div>}

                {msg.role === 'agent' && msg.type === 'text' && (
                  <div className="bg-neutral-900 px-6 py-4 rounded-2xl rounded-tl-sm border border-neutral-800 text-sm leading-relaxed">
                    {msg.content}
                  </div>
                )}

                {msg.role === 'agent' && (msg.type === 'sql_pending' || msg.type === 'sql_executed') && (
                  <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 rounded-tl-sm">
                    <div className="flex items-center justify-between px-4 py-2 bg-neutral-800/50 border-b border-neutral-800">
                      <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                        <Code2 size={14} />
                        Generated SQL {msg.retryCount ? <span className="text-amber-400 ml-2">(Self-healed: {msg.retryCount} retries)</span> : ''}
                      </div>
                      <button onClick={() => copyToClipboard(msg.sql || "")} className="text-neutral-400 hover:text-white transition-colors">
                        <Copy size={14} />
                      </button>
                    </div>
                    <div className="p-4 bg-black/50 overflow-x-auto text-sm">
                      <SyntaxHighlighter language="sql" style={vscDarkPlus} customStyle={{ margin: 0, background: 'transparent' }}>
                        {msg.sql || ""}
                      </SyntaxHighlighter>
                    </div>

                    {msg.type === 'sql_pending' && (
                      <div className="flex gap-2 p-4 border-t border-neutral-800 bg-neutral-900">
                        <button onClick={() => handleApprove(msg.id, true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors">
                          <Check size={16} /> Execute
                        </button>
                        <button onClick={() => handleApprove(msg.id, false)} className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-sm font-medium transition-colors">
                          <X size={16} /> Reject
                        </button>
                      </div>
                    )}

                    {msg.type === 'sql_executed' && (
                      <>
                        <div className="p-4 border-t border-neutral-800 bg-neutral-900">
                          <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3">Explanation</div>
                          <div className="text-sm text-neutral-300 leading-relaxed">{msg.content}</div>
                        </div>
                        {msg.results && msg.results.length > 0 && (
                          <div className="p-4 border-t border-neutral-800 overflow-x-auto">
                            <div className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-3">Results ({msg.results.length} rows)</div>
                            <table className="w-full text-sm text-left">
                              <thead className="text-xs text-neutral-400 uppercase bg-neutral-950/50">
                                <tr>
                                  {Object.keys(msg.results[0]).map(key => (
                                    <th key={key} className="px-4 py-3 font-medium">{key}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.results.map((row, i) => (
                                  <tr key={i} className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors">
                                    {Object.values(row).map((val: any, j) => (
                                      <td key={j} className="px-4 py-3 text-neutral-300">{val?.toString()}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {msg.results && msg.results.length === 0 && (
                          <div className="p-4 border-t border-neutral-800 text-sm text-neutral-500 italic">
                            Query returned no results.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
              
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <User size={20} />
                </div>
              )}
            </div>
          ))}
          {loading && (
            <div className="flex gap-4 max-w-4xl mx-auto">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <Bot size={20} />
              </div>
              <div className="bg-neutral-900 px-6 py-4 rounded-2xl rounded-tl-sm border border-neutral-800 flex items-center gap-3 text-sm text-neutral-400">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                Agent is thinking...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-6 bg-neutral-950 border-t border-neutral-800">
          <div className="max-w-4xl mx-auto relative flex items-center">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask a question about the database..."
              className="w-full bg-neutral-900 border border-neutral-800 text-neutral-100 rounded-full pl-6 pr-14 py-4 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-neutral-600"
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="absolute right-3 p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full transition-colors disabled:opacity-50 disabled:hover:bg-emerald-600"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
