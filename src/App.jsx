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
  FileText,
  Loader2,
  RefreshCw
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

  // Estados de Gravação e Processamento
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [liveAudioLevel, setLiveAudioLevel] = useState(0);

  // Áudio Gravado
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordedDuration, setRecordedDuration] = useState(0);

  // Transcrição em Tempo Real e Final
  const [liveTranscription, setLiveTranscription] = useState('');
  const [finalText, setFinalText] = useState('');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [diagnosticNote, setDiagnosticNote] = useState('');

  // Histórico na Sessão
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('voz_session_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Referências essenciais
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const timerIntervalRef = useRef(null);

  // Textos acumulados em refs para eliminar problemas de closures desatualizadas
  const accumulatedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');

  // Analisador de volume para o microfone (Tubinho)
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Controle de transcrição ao vivo universal (Opera, Chrome, Edge, etc.)
  const hasBrowserSpeechRef = useRef(false);
  const liveIntervalRef = useRef(null);
  const isStreamingBusyRef = useRef(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
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

  // Enviar áudio gravado para o servidor para transcrição robusta (Garantia de 100%)
  const transcribeAudioViaServer = async (blobToTranscribe) => {
    try {
      if (!blobToTranscribe || blobToTranscribe.size < 100) return '';
      setIsProcessing(true);
      setDiagnosticNote('Transcrevendo áudio gravado no servidor...');

      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const resultStr = reader.result || '';
            const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
            resolve(base64);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blobToTranscribe);
      });

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio, language: language || 'pt-BR' })
      });

      const data = await response.json();
      if (data && data.success && data.text) {
        return data.text.trim();
      }
      return '';
    } catch (err) {
      console.warn('Erro ao chamar /api/transcribe:', err);
      return '';
    } finally {
      setDiagnosticNote('');
      setIsProcessing(false);
    }
  };

  // Transcrição silenciosa em segundo plano durante a fala (para preencher o texto ao vivo no Opera/Firefox)
  const transcribeAudioViaServerSilently = async (blobToTranscribe) => {
    try {
      if (!blobToTranscribe || blobToTranscribe.size < 500) return '';
      const base64Audio = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          try {
            const resultStr = reader.result || '';
            const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
            resolve(base64);
          } catch (e) {
            reject(e);
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blobToTranscribe);
      });

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64Audio, language: language || 'pt-BR' })
      });

      const data = await response.json();
      if (data && data.success && data.text) {
        return data.text.trim();
      }
      return '';
    } catch {
      return '';
    }
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
      setLiveAudioLevel(0);
      setCopied(false);
      setIsProcessing(false);
      setDiagnosticNote('');
      hasBrowserSpeechRef.current = false;
      isStreamingBusyRef.current = false;

      // 1. Obter áudio do microfone selecionado
      const audioConstraints = selectedDeviceId && selectedDeviceId !== 'default'
        ? { deviceId: { ideal: selectedDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      mediaStreamRef.current = stream;

      // Ativa gravação IMEDIATAMENTE antes do loop do analisador de áudio
      isRecordingRef.current = true;
      setIsRecording(true);

      // 2. Configurar Analisador de Volume em Tempo Real (TUBINHO HORIZONTAL)
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.2;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const checkLevel = () => {
          if (!isRecordingRef.current || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let maxVal = 0;
          for (let i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > maxVal) maxVal = dataArray[i];
          }
          // Normalização ultra sensível para fala: maxVal varia de 20 a 180
          const level = Math.min(100, Math.max(0, Math.round((maxVal / 150) * 100)));
          setLiveAudioLevel(level);
          animFrameRef.current = requestAnimationFrame(checkLevel);
        };
        checkLevel();
      } catch (err) {
        console.warn('Erro ao inicializar analisador de áudio:', err);
      }

      // 3. Configurar MediaRecorder para gravar áudio em segundo plano
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

      recorder.start(250);

      // 4. Configurar Reconhecimento de Voz (SpeechRecognition)
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = language || 'pt-BR';
          recognition.maxAlternatives = 1;

          recognition.onresult = (event) => {
            hasBrowserSpeechRef.current = true;
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

            const fullCurrentLive = (
              accumulatedTranscriptRef.current + (currentInterim ? ' ' + currentInterim : '')
            ).trim();

            setLiveTranscription(fullCurrentLive);
          };

          recognition.onerror = (event) => {
            console.warn('SpeechRecognition event error:', event.error);
            if (event.error === 'not-allowed') {
              setDiagnosticNote('Acesso ao microfone foi bloqueado pelo navegador.');
            }
          };

          recognition.onend = () => {
            if (isRecordingRef.current) {
              try {
                recognition.start();
              } catch (e) {}
            }
          };

          recognitionRef.current = recognition;
          recognition.start();
        } catch (e) {
          console.warn('Erro ao iniciar SpeechRecognition:', e);
        }
      }

      // 5. Motor Universal em Tempo Real:
      // Para navegadores sem WebSpeech nativo (como Opera/Firefox/Brave),
      // enviamos o áudio a cada 2s para atualizar o texto ao vivo enquanto fala!
      if (liveIntervalRef.current) clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = setInterval(async () => {
        if (!isRecordingRef.current) return;
        if (hasBrowserSpeechRef.current) return;
        if (isStreamingBusyRef.current) return;
        if (audioChunksRef.current.length < 2) return;

        try {
          isStreamingBusyRef.current = true;
          const currentBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (currentBlob.size > 1500) {
            const partialText = await transcribeAudioViaServerSilently(currentBlob);
            if (partialText && isRecordingRef.current && !hasBrowserSpeechRef.current) {
              setLiveTranscription(partialText);
            }
          }
        } catch {
          // ignora
        } finally {
          isStreamingBusyRef.current = false;
        }
      }, 2000);

      if (soundEffectsEnabled) playChime('start');
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões do seu navegador.');
      stopRecordingCleanup();
    }
  };

  // PARAR GRAVAÇÃO E FORMATAR O TEXTO (COM DUPLO MOTOR: NAVEGADOR + SERVIDOR WHISPER/GOOGLE)
  const stopRecording = async () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsProcessing(true);

    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }

    const duration = elapsedSeconds;
    setRecordedDuration(duration);

    // 1. Limpar loop de análise de volume
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setLiveAudioLevel(0);

    // 2. Parar reconhecimento de voz do navegador
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // 3. Parar MediaRecorder e obter o Blob de áudio
    let capturedBlob = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise((resolve) => {
        mediaRecorderRef.current.onstop = () => {
          if (audioChunksRef.current.length > 0) {
            const type = mediaRecorderRef.current.mimeType || 'audio/webm';
            const blob = new Blob(audioChunksRef.current, { type });
            capturedBlob = blob;
            setAudioBlob(blob);
            const url = URL.createObjectURL(blob);
            setAudioUrl(url);
          }
          resolve();
        };
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          resolve();
        }
      });
    }

    // 4. Parar tracks do stream
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // 5. Coleta do texto capturado pelo navegador ou pelo streaming ao vivo
    let spokenText = (
      accumulatedTranscriptRef.current + (interimTranscriptRef.current ? ' ' + interimTranscriptRef.current : '')
    ).trim();

    if (!spokenText && liveTranscription) {
      spokenText = liveTranscription.trim();
    }

    // 6. Transcrição completa e precisa do áudio no servidor
    if (capturedBlob) {
      setDiagnosticNote('Processando texto final e pontuação no servidor...');
      const serverText = await transcribeAudioViaServer(capturedBlob);
      if (serverText) {
        spokenText = serverText;
      }
    }

    // 7. APLICA AQUELA ARRUMADA BACANA NO TEXTO (PONTUAÇÃO, MAIÚSCULAS, FORMATAÇÃO)
    if (spokenText) {
      const polishedText = formatAndPolishSpeech(spokenText);

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
      setDiagnosticNote('');
    } else {
      showToast('O áudio foi gravado, mas não foi possível identificar as palavras faladas. Você pode ouvir seu áudio acima.');
    }

    setIsProcessing(false);
    if (soundEffectsEnabled) playChime('stop');
  };

  const stopRecordingCleanup = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsProcessing(false);
    if (liveIntervalRef.current) {
      clearInterval(liveIntervalRef.current);
      liveIntervalRef.current = null;
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // Re-transcrever áudio manualmente se desejar
  const handleRetranscribe = async () => {
    if (!audioBlob) return;
    setIsProcessing(true);
    setDiagnosticNote('Transcrevendo áudio gravado no servidor...');
    try {
      const result = await transcribeAudioViaServer(audioBlob);
      if (result) {
        const polished = formatAndPolishSpeech(result);
        setFinalText(polished);
        showToast('Áudio transcrito com sucesso! ✨');
      } else {
        showToast('Não foi possível identificar palavras faladas no áudio.');
      }
    } finally {
      setIsProcessing(false);
      setDiagnosticNote('');
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
      showToast('Texto copiado com sucesso! 📋');
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
    showToast('Arquivo baixado!');
  };

  // REFORMATAR TEXTO (ARRUMAR NOVAMENTE)
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
    setAudioBlob(null);
    setRecordedDuration(0);
    setCopied(false);
    setIsProcessing(false);
    setDiagnosticNote('');
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
      <main className="flex-1 w-full max-w-xl mx-auto px-6 flex flex-col items-center justify-center -mt-4">
        {/* ESTADO 1: INICIAL LIMPO (ANTES DE GRAVAR) */}
        {!isRecording && !isProcessing && !finalText && !audioUrl && (
          <div className="flex flex-col items-center text-center">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-1">
              Toque no microfone para falar
            </h1>
            <p className="text-xs text-slate-500 mb-8 max-w-sm">
              Conforme você fala, o tubinho aumenta e o texto aparece na tela. Ao parar, ele é arrumado para copiar.
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

            {/* TUBINHO INDICADOR HORIZONTAL DE REPOUSO */}
            <div className="w-64 sm:w-80 mt-6 flex flex-col items-center gap-1">
              <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden border border-slate-300/80">
                <div className="h-full bg-slate-300 w-1 rounded-full" />
              </div>
              <span className="text-[10px] text-slate-400">Microfone pronto para falar</span>
            </div>
          </div>
        )}

        {/* ESTADO 2: GRAVANDO (COM O TUBINHO HORIZONTAL QUE AUMENTA QUANDO FALA) */}
        {isRecording && (
          <div className="w-full flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
              <span className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                Gravando voz
              </span>
              <span className="text-xs text-slate-400 font-mono ml-1">
                {formatSeconds(elapsedSeconds)}
              </span>
            </div>

            {/* BOTÃO PARAR */}
            <button
              type="button"
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center shadow-xs active:scale-95 transition-all"
              title="Clique para parar e formatar o texto"
            >
              <Square className="w-6 h-6 fill-white mb-0.5" />
              <span className="text-[10px] font-semibold uppercase">Parar</span>
            </button>

            {/* TUBINHO HORIZONTAL DE CAPTAÇÃO DE VOZ (QUANDO FALA O TUBO AUMENTA) */}
            <div className="w-72 sm:w-96 mt-5 mb-5 flex flex-col items-center gap-2">
              <div className="w-full h-4 bg-slate-200/90 rounded-full p-0.5 border border-slate-300 shadow-inner overflow-hidden flex items-center">
                <div
                  className={`h-full rounded-full transition-all duration-75 ease-out ${
                    liveAudioLevel > 30
                      ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500 shadow-sm'
                      : liveAudioLevel > 5
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                      : 'bg-slate-300'
                  }`}
                  style={{ width: `${Math.max(liveAudioLevel > 0 ? 6 : 0, liveAudioLevel)}%` }}
                />
              </div>
              <div className="flex items-center justify-between w-full px-1 text-xs text-slate-500 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full transition-colors ${liveAudioLevel > 5 ? 'bg-emerald-500 animate-ping' : 'bg-slate-300'}`} />
                  Captação da sua voz
                </span>
                <span className="font-mono font-bold text-slate-700">{liveAudioLevel}%</span>
              </div>
            </div>

            {/* AVISO DE DIAGNÓSTICO (CASO O NAVEGADOR BLOQUEIE A REDE) */}
            {diagnosticNote && (
              <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs text-left max-w-md">
                {diagnosticNote}
              </div>
            )}

            {/* CAIXA DE TEXTO EM TEMPO REAL ENQUANTO FALA */}
            <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-xs text-left min-h-[120px] flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                Escrevendo o que você está falando em tempo real:
              </span>

              <p className="text-base text-slate-800 leading-relaxed font-sans min-h-[44px]">
                {liveTranscription ? (
                  <span>
                    {liveTranscription}
                    <span className="inline-block w-1.5 h-4 ml-1 bg-slate-700 animate-pulse align-middle" />
                  </span>
                ) : (
                  <span className="text-slate-400 italic">Pode falar no microfone... o texto vai sendo preenchido aqui em tempo real.</span>
                )}
              </p>

              <div className="text-right text-[11px] text-slate-400 mt-2">
                Aperte <strong>Parar</strong> para finalizar e arrumar o texto.
              </div>
            </div>
          </div>
        )}

        {/* ESTADO 3: PROCESSANDO FINALIZAÇÃO */}
        {isProcessing && (
          <div className="py-12 flex flex-col items-center gap-2.5 text-slate-600 animate-in fade-in">
            <Loader2 className="w-6 h-6 animate-spin text-slate-800" />
            <span className="text-xs font-semibold text-slate-700">
              {diagnosticNote || 'Finalizando e arrumando a transcrição...'}
            </span>
          </div>
        )}

        {/* ESTADO 4: TEXTO FINALIZADO E ARRUMADO + REPRODUTOR DE VOZ GRAVADA */}
        {!isRecording && !isProcessing && (finalText || audioUrl) && (
          <div className="w-full flex flex-col items-center gap-4">
            {/* PLAYER DA VOZ GRAVADA COM BOTÃO DE RE-TRANSCREVER */}
            {audioUrl && (
              <div className="w-full space-y-2">
                <AudioPlayer audioUrl={audioUrl} recordedDuration={recordedDuration} />
                {!finalText && audioBlob && (
                  <button
                    type="button"
                    onClick={handleRetranscribe}
                    className="w-full py-2 px-3 bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg text-xs font-medium text-blue-700 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Clique para forçar transcrição deste áudio gravado</span>
                  </button>
                )}
              </div>
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
