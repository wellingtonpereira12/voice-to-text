import React, { useState } from 'react';
import { History, Copy, Trash2, ChevronDown, ChevronUp, Clock, Check } from 'lucide-react';

export default function HistoryDrawer({ history, onSelectHistoryItem, onClearHistory }) {
  const [isOpen, setIsOpen] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);

  if (history.length === 0) return null;

  const handleCopyItem = async (e, itemText, index) => {
    e.stopPropagation();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(itemText);
      }
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar item:', err);
    }
  };

  return (
    <div className="w-full glass-panel rounded-2xl p-4 border border-slate-800 shadow-md">
      <div
        className="flex items-center justify-between cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-violet-400" />
          <h3 className="font-semibold text-xs sm:text-sm text-slate-200">
            Histórico desta Sessão ({history.length})
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Deseja limpar todo o histórico salvo nesta sessão?')) {
                  onClearHistory();
                }
              }}
              title="Limpar histórico"
              className="text-xs text-slate-400 hover:text-red-400 p-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </div>

      {isOpen && (
        <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1 pt-2 border-t border-slate-800">
          {history.map((item, idx) => (
            <div
              key={item.id || idx}
              onClick={() => onSelectHistoryItem(item.text)}
              className="p-3 rounded-xl bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 hover:border-violet-500/40 cursor-pointer transition-all flex items-start justify-between gap-3 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  {item.duration > 0 && <span>• {item.duration}s de fala</span>}
                </div>
                <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                  {item.text}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => handleCopyItem(e, item.text, idx)}
                title="Copiar este trecho"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-violet-600 text-slate-300 hover:text-white shrink-0 transition-colors"
              >
                {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
