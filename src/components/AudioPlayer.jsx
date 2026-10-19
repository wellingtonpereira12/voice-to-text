import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, Volume2, RotateCcw, Music } from 'lucide-react';

export default function AudioPlayer({ audioBlob, audioUrl, recordedDuration }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
  }, [audioUrl]);

  if (!audioUrl) return null;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Erro ao reproduzir áudio:', err);
      });
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      // Alguns navegadores relatam Infinity para blobs webm gravados; usamos recordedDuration como fallback
      const audioDur = audioRef.current.duration;
      if (isFinite(audioDur) && audioDur > 0) {
        setDuration(audioDur);
      } else if (recordedDuration) {
        setDuration(recordedDuration);
      }
    }
  };

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const formatSeconds = (sec) => {
    if (isNaN(sec) || !isFinite(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `gravacao-voz-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md flex flex-col sm:flex-row items-center gap-3">
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Botão Play / Pause */}
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-xl bg-violet-600 hover:bg-violet-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-violet-600/20 active:scale-95 transition-all"
        title={isPlaying ? 'Pausar áudio' : 'Reproduzir gravação de voz'}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>

      {/* Informações e Barra de Progresso */}
      <div className="flex-1 w-full space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1 font-medium text-slate-300">
            <Music className="w-3.5 h-3.5 text-violet-400" />
            Gravação Recente
          </span>
          <span className="font-mono text-[11px]">
            {formatSeconds(currentTime)} / {formatSeconds(duration || recordedDuration || 0)}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max={duration || recordedDuration || 1}
          step="0.05"
          value={currentTime}
          onChange={handleSeek}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
        />
      </div>

      {/* Botões de Ação do Áudio */}
      <div className="flex items-center gap-2 self-end sm:self-center">
        <button
          type="button"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              setCurrentTime(0);
            }
          }}
          title="Reiniciar áudio"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={downloadAudio}
          title="Baixar arquivo de áudio (.webm)"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-violet-400" />
          <span>Baixar Áudio</span>
        </button>
      </div>
    </div>
  );
}
