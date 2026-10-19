import React, { useEffect, useRef } from 'react';

export default function AudioVisualizer({ stream, isRecording, isPaused }) {
  const canvasRef = useRef(null);
  const animIdRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Se não estiver gravando ou pausado, desenha linha ociosa estática/suave
    if (!isRecording || isPaused || !stream) {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current);
        animIdRef.current = null;
      }

      // Desenha ondas suaves em repouso
      let idlePhase = 0;
      const drawIdle = () => {
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
        ctx.beginPath();

        const centerY = height / 2;
        ctx.moveTo(0, centerY);

        for (let x = 0; x < width; x += 3) {
          const y = centerY + Math.sin((x * 0.02) + idlePhase) * 2;
          ctx.lineTo(x, y);
        }
        ctx.stroke();

        idlePhase += 0.03;
        animIdRef.current = requestAnimationFrame(drawIdle);
      };

      drawIdle();

      return () => {
        if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      };
    }

    // Configura Web Audio API
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const drawWave = () => {
        const width = canvas.width;
        const height = canvas.height;

        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, width, height);

        // Desenha barras espelhadas no centro com gradiente neon
        const barWidth = Math.max(3, (width / bufferLength) * 1.5);
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          const barHeight = Math.max(4, percent * (height * 0.85));

          const gradient = ctx.createLinearGradient(0, height / 2 - barHeight / 2, 0, height / 2 + barHeight / 2);
          gradient.addColorStop(0, '#8b5cf6'); // violeta
          gradient.addColorStop(0.5, '#06b6d4'); // ciano
          gradient.addColorStop(1, '#10b981'); // esmeralda

          ctx.fillStyle = gradient;
          ctx.shadowBlur = 8;
          ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';

          const y = (height - barHeight) / 2;
          // Bordas arredondadas nas barras
          ctx.beginPath();
          ctx.roundRect ? ctx.roundRect(x, y, barWidth - 1.5, barHeight, 3) : ctx.rect(x, y, barWidth - 1.5, barHeight);
          ctx.fill();

          x += barWidth + 1.5;
          if (x > width) break;
        }

        animIdRef.current = requestAnimationFrame(drawWave);
      };

      drawWave();
    } catch (err) {
      console.error('Erro ao iniciar visualizador de áudio:', err);
    }

    return () => {
      if (animIdRef.current) cancelAnimationFrame(animIdRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [isRecording, isPaused, stream]);

  return (
    <div className="w-full h-16 sm:h-20 bg-slate-900/60 rounded-2xl border border-slate-800/80 p-2 flex items-center justify-center overflow-hidden relative shadow-inner">
      <canvas
        ref={canvasRef}
        width={600}
        height={80}
        className="w-full h-full object-contain"
      />
      {isRecording && !isPaused && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-[10px] text-red-300 font-semibold uppercase tracking-wider">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping"></span>
          <span>Captando áudio</span>
        </div>
      )}
      {isPaused && (
        <div className="absolute top-2 right-3 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-[10px] text-amber-300 font-semibold uppercase tracking-wider">
          <span>Pausado</span>
        </div>
      )}
    </div>
  );
}
