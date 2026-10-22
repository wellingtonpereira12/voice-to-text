import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Square, 
  Copy, 
  Check, 
  Settings, 
  Volume2, 
  VolumeX, 
  Download, 
  Trash2, 
  RotateCcw,
  Sparkles,
  FileText
} from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import AudioPlayer from './components/AudioPlayer';
import { playChime } from './utils/audioUtils';
import { formatAndPolishSpeech } from './utils/textFormatter';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    return localStorage.getItem('voz_mic_device_id') || '';
  });
  const [language, setLanguage] = useState('pt-BR');
  const [appendMode, setAppendMode] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveAudioLevel, setLiveAudioLevel] = useState(0);

  // Áudio Gravado
  const [audioUrl, setAudioUrl] = useState(null);
  const [recordedDuration, setRecordedDuration] = useState(0);

  // Transcrição em Tempo Real e Final
  const [liveTranscription, setLiveTranscription] = useState('');
  const [finalText, setFinalText] = useState('');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Histórico na Sessão
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('voz_session_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Referências
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const timerIntervalRef = useRef(null);

  // Refs de transcrição para evitar closures desatualizadas
  const accumulatedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');

  // Analisador de volume para o microfone
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleSelectDevice = (deviceId) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('voz_mic_device_id', deviceId);
  };

  useEffect(() => {
    try {
      localStorage.setItem('voz_session_history', JSON.stringify(history));
    } catch (e) {}
  }, [history]);

  // Timer de gravação
  useEffect(() => {
    if (isRecording) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [isRecording]);

  const formatSeconds = (sec) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // INICIAR GRAVAÇÃO
  const startRecording = async () => {
    try {
      // Limpeza de estados anteriores
      accumulatedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      audioChunksRef.current = [];
      setLiveTranscription('');
      setElapsedSeconds(0);
      setCopied(false);

      // 1. Obter áudio do microfone selecionado (usando ideal para evitar OverconstrainedError no Chrome/Windows)
      const audioConstraints = selectedDeviceId && selectedDeviceId !== 'default'
        ? { deviceId: { ideal: selectedDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      mediaStreamRef.current = stream;

      // 2. Configurar Analisador de Volume em Tempo Real
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioCtx;
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        analyserRef.current = analyser;
        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!isRecordingRef.current || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setLiveAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animFrameRef.current = requestAnimationFrame(checkLevel);
        };
        checkLevel();
      } catch (err) {
        console.warn('Erro ao inicializar analisador de áudio:', err);
      }

      // 3. Configurar MediaRecorder para salvar a gravação da voz
      let mimeType = 'audio/webm;codecs=opus';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : MediaRecorder.isTypeSupported('audio/mp4') 
          ? 'audio/mp4' 
          : '';
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        if (audioChunksRef.current.length > 0) {
          const type = recorder.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type });
          const url = URL.createObjectURL(blob);
          setAudioUrl(url);
        }
      };

      recorder.start(250);

      // 4. Configurar Reconhecimento de Voz (SpeechRecognition)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language || 'pt-BR';
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              const cleanFinal = transcript.trim();
              if (cleanFinal) {
                accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + cleanFinal;
              }
            } else {
              currentInterim += transcript;
            }
          }

          interimTranscriptRef.current = currentInterim;

          // Atualiza o texto na tela EM TEMPO REAL enquanto o usuário fala!
          const fullCurrentLive = (
            accumulatedTranscriptRef.current + (currentInterim ? ' ' + currentInterim : '')
          ).trim();

          setLiveTranscription(fullCurrentLive);
        };

        recognition.onerror = (event) => {
          console.warn('SpeechRecognition event error:', event.error);
          if (event.error === 'not-allowed') {
            showToast('Acesso ao microfone foi bloqueado pelo navegador.');
          }
        };

        recognition.onend = () => {
          // Se ainda deve estar gravando, reinicia automaticamente para não cortar a fala
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (e) {}
          }
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch (e) {
          console.error('Erro ao iniciar reconhecimento:', e);
        }
      } else {
        alert('Seu navegador não possui suporte ao reconhecimento de voz nativo. Recomendamos usar o Google Chrome ou Microsoft Edge.');
      }

      isRecordingRef.current = true;
      setIsRecording(true);

      if (soundEffectsEnabled) playChime('start');
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões do seu navegador.');
      stopRecordingCleanup();
    }
  };

  // PARAR GRAVAÇÃO E FORMATAR O TEXTO (ESTILO ANTIGRAVITY)
  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    const duration = elapsedSeconds;
    setRecordedDuration(duration);

    // 1. Limpar loop de análise de volume
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setLiveAudioLevel(0);

    // 2. Parar gravador de áudio para salvar a gravação da voz
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('Erro ao parar gravação:', e);
      }
    }

    // 3. Parar tracks do stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // 4. Parar reconhecimento de voz
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // 5. Capturar todo o texto falado (acumulado final + resíduo interino)
    const rawSpokenText = (
      accumulatedTranscriptRef.current + (interimTranscriptRef.current ? ' ' + interimTranscriptRef.current : '')
    ).trim();

    // 6. DAR AQUELA ARRUMADA NO TEXTO BACANA (pontuação falada, maiúsculas, espaçamento)
    if (rawSpokenText) {
      const polishedText = formatAndPolishSpeech(rawSpokenText);

      setFinalText((prev) => {
        if (!prev || !appendMode) return polishedText;
        return prev + '\n\n' + polishedText;
      });

      // Salva no histórico da sessão
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          text: polishedText,
          duration,
          timestamp: new Date().toISOString()
        },
        ...prev.slice(0, 19)
      ]);
    } else {
      // Se por algum motivo o Chrome não pegou o texto das palavras, avisa mas mantém o player de áudio disponível!
      showToast('O áudio foi gravado com sucesso! Nenhuma palavra foi identificada na fala.');
    }

    if (soundEffectsEnabled) playChime('stop');
  };

  const stopRecordingCleanup = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // COPIAR TEXTO
  const handleCopy = async () => {
    if (!finalText.trim()) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(finalText);
      } else {
        const ta = document.createElement('textarea');
        ta.value = finalText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      showToast('Texto copiado para a área de transferência!');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      showToast('Falha ao copiar.');
    }
  };

  // OUVIR TEXTO
  const handleSpeakText = () => {
    if (!window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    if (!finalText.trim()) return;

    const u = new SpeechSynthesisUtterance(finalText);
    u.lang = language || 'pt-BR';
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  // BAIXAR .TXT
  const handleDownloadTxt = () => {
    if (!finalText.trim()) return;
    const blob = new Blob([finalText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-voz-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Arquivo de texto baixado!');
  };

  // REORGANIZAR / FORMATAR TEXTO MANUALMENTE
  const handlePolishAgain = () => {
    if (!finalText.trim()) return;
    const polished = formatAndPolishSpeech(finalText);
    setFinalText(polished);
    showToast('Texto reformatado com sucesso!');
  };

  // LIMPAR
  const handleReset = () => {
    setFinalText('');
    setLiveTranscription('');
    setAudioUrl(null);
    setRecordedDuration(0);
    setCopied(false);
    if (isSpeaking && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 flex flex-col justify-between font-sans">
      {/* Toast flutuante */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-md transition-all">
          {toastMessage}
        </div>
      )}

      {/* CABEÇALHO */}
      <header className="w-full max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="text-base font-semibold tracking-tight text-slate-900">
          Voz
        </div>

        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          disabled={isRecording}
          className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded-md hover:bg-slate-200/60 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Configurações</span>
        </button>
      </header>

      {/* ÁREA CENTRAL */}
      <main className="flex-1 w-full max-w-xl mx-auto px-6 flex flex-col items-center justify-center -mt-6">
        {/* ESTADO 1: INICIAL LIMPO (ANTES DE GRAVAR) */}
        {!isRecording && !finalText && !audioUrl && (
          <div className="flex flex-col items-center text-center">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-1">
              Toque no microfone para falar
            </h1>
            <p className="text-xs text-slate-500 mb-8 max-w-sm">
              Conforme você fala, o texto vai aparecendo na tela em tempo real. Ao parar, ele fica pronto para copiar.
            </p>

            {/* BOTÃO DO MICROFONE */}
            <button
              type="button"
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-xs active:scale-95 transition-all"
              title="Clique para falar"
            >
              <Mic className="w-8 h-8" />
            </button>
          </div>
        )}

        {/* ESTADO 2: GRAVANDO (ESCREVE EM TEMPO REAL EMBAIXO DO MICROFONE!) */}
        {isRecording && (
          <div className="w-full flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                Ouvindo sua voz
              </span>
              <span className="text-xs text-slate-400 font-mono ml-1">
                {formatSeconds(elapsedSeconds)}
              </span>

              {/* Indicador de captação de som */}
              {liveAudioLevel > 10 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="Detectando áudio no microfone"></span>
              )}
            </div>

            {/* BOTÃO PARAR */}
            <button
              type="button"
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center shadow-xs active:scale-95 transition-all mb-6"
              title="Clique para parar e formatar o texto"
            >
              <Square className="w-6 h-6 fill-white mb-0.5" />
              <span className="text-[10px] font-semibold uppercase">Parar</span>
            </button>

            {/* CAIXA DE TEXTO EM TEMPO REAL ENQUANTO FALA */}
            <div className="w-full bg-white border border-slate-200 rounded-xl p-4 shadow-xs text-left min-h-[100px] flex flex-col justify-between">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block mb-1">
                Escrevendo o que você está falando:
              </span>

              <p className="text-base text-slate-800 leading-relaxed font-sans">
                {liveTranscription ? (
                  <span>{liveTranscription}</span>
                ) : (
                  <span className="text-slate-400 italic">Fale agora no microfone...</span>
                )}
              </p>

              <div className="text-right text-[11px] text-slate-400 mt-2">
                Clique em <strong>Parar</strong> para finalizar e arrumar o texto.
              </div>
            </div>
          </div>
        )}

        {/* ESTADO 3: TEXTO FINALIZADO E ARRUMADO + REPRODUTOR DE VOZ GRAVADA */}
        {!isRecording && (finalText || audioUrl) && (
          <div className="w-full flex flex-col items-center gap-4">
            {/* PLAYER DA VOZ GRAVADA (SUA VOZ NUNCA SE PERDE!) */}
            {audioUrl && (
              <AudioPlayer audioUrl={audioUrl} recordedDuration={recordedDuration} />
            )}

            {/* CARTÃO DE TEXTO ARRUMADO */}
            <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-600" />
                  Texto Transcrito e Arrumado
                </span>
                <span>{finalText.split(/\s+/).filter(Boolean).length} palavras</span>
              </div>

              {/* CAIXA DE TEXTO EDITÁVEL */}
              <textarea
                value={finalText}
                onChange={(e) => setFinalText(e.target.value)}
                rows={6}
                placeholder="Seu texto transcrito aparecerá aqui..."
                className="w-full bg-transparent text-slate-800 text-base leading-relaxed outline-none resize-y font-sans"
              />

              {/* BARRA DE AÇÕES */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100 gap-2 flex-wrap">
                {/* BOTÃO COPIAR PRINCIPAL */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                  title="Copiar texto para área de transferência"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar texto'}</span>
                </button>

                {/* BOTÕES SECUNDÁRIOS */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePolishAgain}
                    title="Dar aquela arrumada na pontuação novamente"
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleSpeakText}
                    title={isSpeaking ? 'Parar leitura' : 'Ouvir texto em voz alta'}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    {isSpeaking ? <VolumeX className="w-4 h-4 text-red-600" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    title="Baixar arquivo de texto (.txt)"
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    title="Limpar e gravar novo"
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* BOTÕES DE NOVA GRAVAÇÃO */}
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-800 text-xs font-medium shadow-xs transition-colors"
              >
                <Mic className="w-3.5 h-3.5 text-slate-600" />
                <span>Gravar novamente</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Nova fala</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* RODAPÉ */}
      <footer className="w-full max-w-3xl mx-auto px-6 py-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>Voz</span>
        <span>Áudio processado diretamente no seu navegador</span>
      </footer>

      {/* MODAL DE CONFIGURAÇÕES */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        selectedDeviceId={selectedDeviceId}
        onSelectDevice={handleSelectDevice}
        language={language}
        setLanguage={setLanguage}
        appendMode={appendMode}
        setAppendMode={setAppendMode}
        soundEffectsEnabled={soundEffectsEnabled}
        setSoundEffectsEnabled={setSoundEffectsEnabled}
        history={history}
        onSelectHistoryItem={(h) => setFinalText(h)}
        onClearHistory={() => setHistory([])}
      />
    </div>
  );
}
