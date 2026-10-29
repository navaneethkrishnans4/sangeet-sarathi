"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Download, Bot, User, Table as TableIcon } from 'lucide-react';
import { exportToCSV } from '@/lib/export';

type Message = {
    id: string;
    role: 'user' | 'assistant';
    text: string;
    data?: any[];
};

export default function ChatPage() {
    const [messages, setMessages] = useState<Message[]>([
        { id: 'initial', role: 'assistant', text: 'Hi! I am your AI Database Assistant. You can ask me questions about your Candidates, Teachers, and Transactions. For example, "How many candidates enrolled from teacher Shone Music School?"' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMsg = input.trim();
        setInput('');
        
        const newMessage: Message = { id: Date.now().toString(), role: 'user', text: userMsg };
        setMessages(prev => [...prev, newMessage]);
        setIsLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMsg })
            });

            const responseData = await res.json();
            
            if (!res.ok) {
                setMessages(prev => [...prev, {
                    id: Date.now().toString(),
                    role: 'assistant',
                    text: `Error: ${responseData.error || 'Failed to process query'}`
                }]);
                return;
            }

            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: responseData.message,
                data: responseData.data
            }]);

        } catch (error) {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                text: 'A network error occurred while reaching the AI assistant.'
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    // Render Data Table component
    const DataTable = ({ data }: { data: any[] }) => {
        if (!data || data.length === 0) return null;
        
        // Don't render huge tables, cap at 100 rows for display
        const displayData = data.slice(0, 100);
        const headers = Object.keys(displayData[0]);

        return (
            <div className="mt-4 border rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm shadow-sm w-full">
                <div className="flex justify-between items-center p-3 border-b bg-gray-50/50">
                    <span className="text-sm font-medium text-gray-600 flex items-center gap-2">
                        <TableIcon size={16} />
                        {data.length} {data.length === 1 ? 'Row' : 'Rows'} {data.length > 100 ? '(Showing first 100)' : ''}
                    </span>
                    <button 
                        onClick={() => exportToCSV(data, `Export_${new Date().toISOString().slice(0,10)}.csv`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                    >
                        <Download size={14} /> Download CSV
                    </button>
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50/80 sticky top-0 shadow-sm z-10">
                            <tr>
                                {headers.map(header => (
                                    <th key={header} className="px-4 py-3 whitespace-nowrap">{header}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {displayData.map((row, i) => (
                                <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50/50 transition-colors">
                                    {headers.map(header => (
                                        <td key={`${i}-${header}`} className="px-4 py-3 whitespace-nowrap text-gray-700">
                                            {row[header] !== null ? String(row[header]) : <span className="text-gray-300 italic">null</span>}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto w-full pt-8 pb-4 px-4 sm:px-6">
            <div className="flex-1 bg-white border shadow-sm rounded-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b bg-gray-50/50 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0">
                        <Bot size={18} />
                    </div>
                    <div>
                        <h1 className="font-semibold text-gray-800 m-0">Database Assistant</h1>
                        <p className="text-xs text-gray-500 m-0">Powered by Gemini 1.5 Pro</p>
                    </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-gray-800 text-white' : 'bg-blue-100 text-blue-600'}`}>
                                {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                            </div>
                            
                            <div className={`max-w-[85%] ${msg.role === 'user' ? 'items-end flex flex-col' : 'items-start flex flex-col'}`}>
                                <div className={`px-4 py-3 rounded-2xl ${msg.role === 'user' ? 'bg-gray-800 text-white rounded-tr-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm'}`}>
                                    <p className="whitespace-pre-wrap m-0">{msg.text}</p>
                                </div>
                                {msg.data && Array.isArray(msg.data) && msg.data.length > 0 && (
                                    <div className="mt-2 w-full max-w-full">
                                        <DataTable data={msg.data} />
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                <Bot size={16} />
                            </div>
                            <div className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-800 rounded-tl-sm flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white border-t">
                    <form onSubmit={handleSubmit} className="flex gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about your candidates, teachers, or transactions..."
                            disabled={isLoading}
                            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all disabled:opacity-50 text-gray-900"
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-5 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Send size={18} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
