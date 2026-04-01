'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

type Message = { id: string, role: 'user' | 'system', content: string, options?: any[] };

export default function QuickActionChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'system', content: 'Hi! I am your quick action assistant. I can help you:\n• View / create branches\n• Make a branch inactive / active\n• Create work orders\n• Record payments\n• View passbooks\n\nWhat would you like to do?' }
  ]);
  const [state, setState] = useState<any>({ intent: null, entities: {} });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (text: string, overrideState?: any) => {
    if (!text.trim()) return;

    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/quick-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, state: overrideState || state })
      });
      const data = await res.json();

      if (data.status === 'COMPLETE') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: data.message }]);
        setState({ intent: null, entities: {} });
        setTimeout(() => {
          setIsOpen(false);
          router.push(data.actionUrl);
        }, 1000);
      } else if (data.status === 'AMBIGUOUS') {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: data.message, options: data.options }]);
        setState(data.state);
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: data.message }]);
        setState(data.state || { intent: null, entities: {} });
      }
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'system', content: 'Error connecting to assistant.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (option: any) => {
    const nextState = { ...state };
    if (option.type === 'branch') {
      nextState.entities.branchId = option.id;
      nextState.entities.branchName = option.name;
    } else if (option.type === 'employee') {
      nextState.entities.employeeId = option.id;
      nextState.entities.employeeName = option.name;
      nextState.entities.type = option.empType;
    } else {
      nextState.entities.vendorId = option.id;
      nextState.entities.vendorName = option.name;
      nextState.entities.type = 'vendor';
    }

    handleSend(option.name, nextState);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
            style={{ height: '450px' }}
          >
            <div className="bg-uff-primary text-white p-4 flex items-center justify-between">
              <span className="font-semibold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Quick Actions
              </span>
              <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50">
              {messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm whitespace-pre-line ${m.role === 'user' ? 'bg-uff-accent text-uff-primary' : 'bg-white border border-slate-200 text-slate-800 shadow-sm'}`}>
                    {m.content}
                  </div>
                  {m.options && (
                    <div className="mt-2 flex flex-col gap-2 w-full pl-2">
                      {m.options.map((opt: any) => (
                        <button
                          key={opt.id}
                          onClick={() => handleOptionSelect(opt)}
                          disabled={loading}
                          className="text-left px-3 py-2 text-sm bg-white border border-uff-accent/30 hover:bg-uff-accent/10 rounded-lg text-uff-primary font-medium transition disabled:opacity-50"
                        >
                          {opt.name} <span className="text-xs text-slate-500 font-normal">({opt.type === 'branch' ? opt.empType : opt.type === 'employee' ? opt.empType : 'vendor'})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex items-start">
                  <div className="px-4 py-2 rounded-2xl bg-white border border-slate-200 text-slate-500 shadow-sm text-sm">
                    Thinking...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-3 bg-white border-t border-slate-200">
              <form onSubmit={e => { e.preventDefault(); handleSend(input); }} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Type a command..."
                  disabled={loading}
                  className="flex-1 px-3 py-2 bg-slate-100 border-transparent rounded-xl text-sm focus:ring-2 focus:ring-uff-accent focus:bg-white transition disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-2 shrink-0 bg-uff-primary text-white rounded-xl hover:bg-uff-primary/90 disabled:opacity-50 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 bg-uff-accent text-uff-primary rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-uff-accent"
        aria-label="Quick Actions"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </button>
    </div>
  );
}
