import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Shield, Clock } from 'lucide-react';

export default function ChatComponent({ otId, userRole, userName }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const chatContainerRef = useRef(null);
  const prevLengthRef = useRef(0);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat/${otId}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("Error fetching messages:", err);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll messages every 5 seconds for simulation
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [otId]);

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || loading) return;

    setLoading(true);
    const msgData = {
      ot_id: otId,
      usuario: userName || 'Usuario Anónimo',
      rol: userRole,
      mensaje: newMessage.trim()
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(msgData)
      });
      const savedMsg = await res.json();
      setMessages(prev => [...prev, savedMsg]);
      setNewMessage('');
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadgeStyle = (rol) => {
    switch (rol) {
      case 'Gerencia': return 'bg-red-50 text-red-700 border-red-200';
      case 'Operaciones': return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Comercial': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Planta': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'Pañol': return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'Lonas': return 'bg-teal-50 text-teal-700 border-teal-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-blue-900" />
        <span className="text-xs font-black uppercase text-blue-900 tracking-wider Poppins">Chat de Coordinación OT</span>
      </div>

      {/* Messages */}
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30">
        {messages.length > 0 ? (
          messages.map((msg) => {
            const isMe = msg.usuario === userName && msg.rol === userRole;
            return (
              <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[10px] font-black text-slate-700">{msg.usuario}</span>
                  <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full border ${getRoleBadgeStyle(msg.rol)}`}>
                    {msg.rol}
                  </span>
                </div>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-xs border ${
                  isMe 
                    ? 'bg-blue-900 text-white border-blue-950 rounded-tr-none' 
                    : 'bg-white text-slate-800 border-slate-200 rounded-tl-none'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.mensaje}</p>
                </div>
                <span className="text-[8px] text-slate-400 font-semibold mt-1 flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {new Date(msg.fecha_envio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <MessageSquare className="w-8 h-8 text-slate-400 mb-1" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sin mensajes</span>
            <p className="text-[9px] text-slate-400 mt-1 max-w-[200px]">Coordina aquí cambios logísticos de urgencia.</p>
          </div>
        )}
      </div>

      {/* Message input */}
      <form onSubmit={handleSendMessage} className="border-t border-slate-200 p-2.5 flex gap-2 bg-white">
        <input
          type="text"
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all-300 Poppins"
          placeholder="Escribe un mensaje de urgencia..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={loading}
        />
        <button
          type="submit"
          className="bg-blue-900 text-white p-2 rounded-xl hover:bg-blue-950 transition-all-300 shadow-md disabled:opacity-50"
          disabled={loading || !newMessage.trim()}
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </form>
    </div>
  );
}
