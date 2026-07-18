import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sprout, Bot, User, Loader2 } from 'lucide-react';

interface Props {
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIAssistantModal: React.FC<Props> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Salut! Sunt Asistentul tău pentru Noua Peluză. Cu ce te pot ajuta astăzi? (ex: Cum pregătesc solul pentru gazon nou?)'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, { role: 'user', content: userMessage }] })
      });

      if (!response.ok) {
        throw new Error('Eroare la comunicarea cu serverul.');
      }

      const data = await response.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Ne pare rău, am întâmpinat o eroare de comunicare. Te rugăm să încerci din nou.' 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Simple markdown parser for bold and newlines
  const formatText = (text: string) => {
    const parts = text.split('\n').map((line, i) => {
      // Handle bold
      const boldParts = line.split(/\\*\\*(.*?)\\*\\*/g);
      const formattedLine = boldParts.map((part, index) => 
        index % 2 === 1 ? <strong key={index} className="text-text-main font-black">{part}</strong> : part
      );
      
      return (
        <p key={i} className="mb-2 last:mb-0 text-sm leading-relaxed">
          {formattedLine}
        </p>
      );
    });
    return <>{parts}</>;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center p-0 md:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full md:w-[600px] h-[90vh] md:h-[700px] bg-bg-card md:rounded-[2rem] shadow-2xl flex flex-col border border-border-color overflow-hidden animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-400">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-border-color bg-gradient-to-r from-accent-color/10 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-color/20 text-accent-color flex items-center justify-center">
              <Sprout size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-text-main leading-tight">Asistent Noua Peluză</h2>
              <p className="text-[10px] text-accent-color uppercase tracking-widest font-bold">AI Agronom</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-bg-main hover:bg-border-color flex items-center justify-center text-text-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-start gap-3 max-w-[85%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                msg.role === 'user' 
                  ? 'bg-bg-main border border-border-color text-text-secondary' 
                  : 'bg-accent-color text-white shadow-lg shadow-accent-color/20'
              }`}>
                {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
              </div>
              <div className={`p-4 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-accent-color/10 border border-accent-color/20 text-text-main rounded-tr-sm'
                  : 'bg-bg-main border border-border-color text-text-secondary rounded-tl-sm'
              }`}>
                {formatText(msg.content)}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-start gap-3 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-accent-color text-white shadow-lg shadow-accent-color/20 flex items-center justify-center shrink-0">
                <Bot size={14} />
              </div>
              <div className="p-4 rounded-2xl bg-bg-main border border-border-color rounded-tl-sm flex items-center gap-2">
                <div className="w-2 h-2 bg-accent-color rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-accent-color rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-accent-color rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 p-4 border-t border-border-color bg-bg-main">
          <div className="relative flex items-center">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Întreabă orice despre grădina ta..."
              className="w-full bg-bg-card border border-border-color rounded-2xl py-3 pl-4 pr-12 text-sm text-text-main focus:outline-none focus:border-accent-color/50 focus:ring-1 focus:ring-accent-color/50 resize-none"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              className="absolute right-2 w-8 h-8 rounded-xl bg-accent-color text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-accent-color/90 transition-colors shadow-sm"
            >
              {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
          <p className="text-[10px] text-text-secondary text-center mt-2">
            Asistentul folosește protocoale din Master Academy. Pentru sfaturi critice, consultați întotdeauna agronomul.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AIAssistantModal;
