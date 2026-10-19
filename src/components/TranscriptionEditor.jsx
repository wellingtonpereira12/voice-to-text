import React, { useState, useRef } from 'react';
import { 
  Copy, 
  Check, 
  Download, 
  Trash2, 
  Volume2, 
  VolumeX, 
  FileText, 
  Sparkles, 
  Share2,
  Clock,
  Type
} from 'lucide-react';

export default function TranscriptionEditor({
  text,
  setText,
  interimText,
  isRecording,
  appendMode,
  setAppendMode
}) {
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const textareaRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // Copiar para a Área de Transferência
  const handleCopy = async () => {
    const fullTextToCopy = (text + (interimText ? ' ' + interimText : '')).trim();
    if (!fullTextToCopy) {
      showToast('⚠️ Nenhum texto para copiar.');
      return;
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullTextToCopy);
      } else {
        // Fallback para navegadores antigos
        const textarea = document.createElement('textarea');
        textarea.value = fullTextToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      showToast('🎉 Texto copiado com sucesso!');
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Erro ao copiar texto:', err);
      showToast('❌ Falha ao copiar texto.');
    }
  };

  // Baixar arquivo .txt
  const handleDownloadTxt = () => {
    if (!text.trim()) {
      showToast('⚠️ Nenhum texto para baixar.');
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-voxscript-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('📄 Arquivo .txt baixado!');
  };

  // Ler texto em voz alta (Text-to-Speech)
  const handleSpeakText = () => {
    if (!window.speechSynthesis) {
      showToast('SpeechSynthesis não suportado neste navegador.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const textToRead = text.trim();
    if (!textToRead) {
      showToast('⚠️ Nenhum texto para narrar.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Formatar / Capitalizar primeiras letras
  const handleFormatText = () => {
    if (!text.trim()) return;
    // Formata: primeira letra de cada frase maiúscula
    const formatted = text
      .replace(/(^\s*|\.\s+)([a-z\u00C0-\u00FF])/g, (match, prefix, char) => prefix + char.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
    setText(formatted);
    showToast('✨ Formatação de pontuação aplicada!');
  };

  // Limpar texto
  const handleClear = () => {
    if (!text.trim()) return;
    if (window.confirm('Tem certeza de que deseja limpar o texto transcrito?')) {
      setText('');
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
      }
      showToast('🗑️ Texto limpo.');
    }
  };

  // Estatísticas
  const characterCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const estimatedReadingMinutes = Math.max(1, Math.round(wordCount / 150));

  return (
    <div className="w-full glass-panel rounded-3xl p-5 sm:p-6 border border-slate-800 shadow-xl relative flex flex-col gap-4">
      {/* Toast Notification Flutuante */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-900 border border-violet-500/60 text-white text-xs font-semibold shadow-2xl shadow-violet-500/20 animate-in fade-in slide-in-from-top-2 duration-200 flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cabeçalho do Editor com Ferramentas */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-violet-600/20 border border-violet-500/40 flex items-center justify-center text-violet-400">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
              Texto Transcrito
              {isRecording && (
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 text-[10px] font-normal">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping"></span>
                  Transcrevendo...
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              O áudio falado é convertido automaticamente em texto
            </p>
          </div>
        </div>

        {/* Botão de Cópia Principal e Ações Rápidas */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all shadow-lg active:scale-95 ${
              copied
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30'
            }`}
            title="Copiar texto para a área de transferência"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-white" />
                <span>Copiar Texto</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadTxt}
            disabled={!text.trim()}
            title="Baixar arquivo de texto (.txt)"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleSpeakText}
            disabled={!text.trim()}
            title={isSpeaking ? 'Parar leitura em voz alta' : 'Ouvir texto transcrito'}
            className={`p-2.5 rounded-xl border transition-colors ${
              isSpeaking
                ? 'bg-amber-600/30 border-amber-500/50 text-amber-300 animate-pulse'
                : 'bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white border-slate-700/80'
            }`}
          >
            {isSpeaking ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={handleFormatText}
            disabled={!text.trim()}
            title="Auto-formatar maiúsculas e pontuação"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-violet-400" />
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={!text.trim()}
            title="Limpar texto"
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-red-950/60 hover:border-red-700/60 disabled:opacity-40 disabled:cursor-not-allowed text-slate-300 hover:text-red-300 border border-slate-700/80 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Área de Texto Principal */}
      <div className="relative min-h-[220px] sm:min-h-[280px] flex flex-col">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isRecording
              ? 'Fale algo no microfone selecionado... Sua fala aparecerá aqui em tempo real!'
              : 'Clique no botão de gravar abaixo, fale ao microfone e depois aperte Parar para converter sua voz em texto. Você também pode digitar ou editar o texto livremente aqui.'
          }
          className="w-full flex-1 p-4 bg-slate-950/70 rounded-2xl border border-slate-800 focus:border-violet-500/80 focus:ring-2 focus:ring-violet-500/20 text-slate-100 placeholder-slate-500 text-sm sm:text-base leading-relaxed resize-y outline-none transition-all font-sans min-h-[200px]"
        />

        {/* Prévia de fala ao vivo (interim speech recognition) */}
        {isRecording && interimText && (
          <div className="mt-2 p-3 rounded-xl bg-violet-950/30 border border-violet-800/40 text-violet-200 text-xs sm:text-sm italic flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse shrink-0"></span>
            <span className="opacity-90">"{interimText}"</span>
          </div>
        )}
      </div>

      {/* Barra de Rodapé com Estatísticas e Modo de Adição */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Type className="w-3.5 h-3.5 text-slate-500" />
            <strong className="text-slate-300 font-mono">{characterCount}</strong> caracteres
          </span>
          <span className="flex items-center gap-1.5">
            <strong className="text-slate-300 font-mono">{wordCount}</strong> palavras
          </span>
          {wordCount > 0 && (
            <span className="flex items-center gap-1.5 hidden sm:flex">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              aprox. <strong className="text-slate-300">{estimatedReadingMinutes} min</strong> de leitura
            </span>
          )}
        </div>

        {/* Opção: Modo de gravação (anexar ou sobrescrever) */}
        <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white transition-colors">
          <input
            type="checkbox"
            checked={appendMode}
            onChange={(e) => setAppendMode(e.target.checked)}
            className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-900"
          />
          <span className="text-xs">Anexar ao texto anterior</span>
        </label>
      </div>
    </div>
  );
}
