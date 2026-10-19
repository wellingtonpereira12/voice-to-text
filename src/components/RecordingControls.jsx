import React from 'react';
import { Mic, Square, Pause, Play, Globe, Radio, Volume2 } from 'lucide-react';

export default function RecordingControls({
  isRecording,
  isPaused,
  onStartRecording,
  onStopRecording,
  onTogglePause,
  elapsedSeconds,
  language,
  setLanguage,
  soundEffectsEnabled,
  setSoundEffectsEnabled
}) {
  const formatTime = (totalSec) => {
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;

    const pad = (n) => n.toString().padStart(2, '0');
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}`;
  };

  const languages = [
    { code: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
    { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
    { code: 'es-ES', label: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
    { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'it-IT', label: 'Italiano', flag: '🇮🇹' },
  ];

  return (
    <div className="w-full flex flex-col items-center gap-5 my-2">
      {/* Timer e Status da Gravação */}
      <div className="flex items-center gap-3">
        {isRecording ? (
          <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-red-950/50 border border-red-800/60 text-red-300 shadow-lg shadow-red-900/20">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-xs font-semibold uppercase tracking-wider">
              {isPaused ? 'Gravação Pausada' : 'Gravando Voz'}
            </span>
            <span className="font-mono text-sm font-bold text-white ml-1">
              {formatTime(elapsedSeconds)}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/60 border border-slate-800 text-slate-400 text-xs">
            <Radio className="w-3.5 h-3.5 text-slate-500" />
            <span>Pronto para gravar</span>
          </div>
        )}
      </div>

      {/* Botões Centrais de Gravação */}
      <div className="flex items-center gap-4 sm:gap-6">
        {/* Botão Pausar / Retomar (apenas visível durante gravação) */}
        {isRecording && (
          <button
            type="button"
            onClick={onTogglePause}
            className="w-12 h-12 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center transition-all shadow-md active:scale-95"
            title={isPaused ? 'Retomar gravação' : 'Pausar gravação'}
          >
            {isPaused ? <Play className="w-5 h-5 fill-current ml-0.5" /> : <Pause className="w-5 h-5 fill-current" />}
          </button>
        )}

        {/* Botão Principal: Iniciar ou Parar Gravação */}
        {!isRecording ? (
          <button
            type="button"
            onClick={onStartRecording}
            className="group relative flex items-center justify-center gap-3 px-8 py-4 sm:px-10 sm:py-5 rounded-3xl font-bold text-base sm:text-lg text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-xl shadow-violet-600/30 hover:shadow-violet-600/50 active:scale-95 transition-all duration-200"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <span>Iniciar Gravação</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStopRecording}
            className="animate-pulse-ring relative flex items-center justify-center gap-3 px-8 py-4 sm:px-10 sm:py-5 rounded-3xl font-bold text-base sm:text-lg text-white bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-2xl shadow-red-600/50 active:scale-95 transition-all duration-200"
            title="Clique para parar e transcrever o áudio falado em texto"
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Square className="w-4 h-4 fill-white text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span>Parar Gravação</span>
              <span className="text-[11px] font-normal text-rose-100 opacity-90">Transcrever em texto</span>
            </div>
          </button>
        )}
      </div>

      {/* Seleção de Idioma de Fala e Efeitos Sonoros */}
      <div className="flex items-center gap-4 flex-wrap justify-center mt-2">
        {/* Seletor de Idioma */}
        <div className="flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <Globe className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-slate-400 font-medium">Idioma:</span>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={isRecording}
            className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer text-xs"
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-slate-900 text-slate-100">
                {lang.flag} {lang.label}
              </option>
            ))}
          </select>
        </div>

        {/* Som de bip ao gravar */}
        <button
          type="button"
          onClick={() => setSoundEffectsEnabled(!soundEffectsEnabled)}
          title="Ativar/desativar efeito sonoro de clique"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
            soundEffectsEnabled
              ? 'bg-violet-950/40 border-violet-800/50 text-violet-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-400'
          }`}
        >
          <Volume2 className="w-3.5 h-3.5" />
          <span>Sons de Gravação</span>
        </button>
      </div>
    </div>
  );
}
