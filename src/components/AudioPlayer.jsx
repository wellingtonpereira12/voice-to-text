import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Download, RotateCcw, Volume2 } from 'lucide-react';

export default function AudioPlayer({ audioUrl, recordedDuration }) {
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
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const downloadAudio = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `audio-gravado-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-center gap-3 text-slate-700">
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
        className="w-9 h-9 rounded-md bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shrink-0 transition-colors"
        title={isPlaying ? 'Pausar áudio' : 'Ouvir sua voz gravada'}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>

      {/* Informações e Barra de Progresso */}
      <div className="flex-1 w-full space-y-1">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1 font-medium text-slate-700">
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            Sua voz gravada
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
          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-800"
        />
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center gap-1.5 self-end sm:self-center">
        <button
          type="button"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              setCurrentTime(0);
            }
          }}
          title="Reiniciar áudio"
          className="p-1.5 rounded-md hover:bg-slate-200 text-slate-600 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={downloadAudio}
          title="Baixar arquivo de áudio (.webm)"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Baixar áudio</span>
        </button>
      </div>
    </div>
  );
}
