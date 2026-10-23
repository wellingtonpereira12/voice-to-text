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
  const [settingsTab, setSettingsTab] = useState('audio');
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    return localStorage.getItem('voz_mic_device_id') || '';
  });
  const [language, setLanguage] = useState('pt-BR');
  const [appendMode, setAppendMode] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);

  // Estados de IA para Correção e Pontuação
  const [aiEnabled, setAiEnabled] = useState(() => {
    return localStorage.getItem('voz_ai_enabled') !== 'false';
  });
  const [aiProvider, setAiProvider] = useState(() => {
    return localStorage.getItem('voz_ai_provider') || 'gemini';
  });
  const [aiApiKey, setAiApiKey] = useState(() => {
    return localStorage.getItem('voz_ai_key') || '';
  });
  const [isAiPolishing, setIsAiPolishing] = useState(false);

  // Estados de Gravação e Processamento
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Equalizador Musical Suave de 5 Barras (física de Attack e Decay suave)
  const [audioBars, setAudioBars] = useState([6, 6, 6, 6, 6]);
  const barsRef = useRef([6, 6, 6, 6, 6]);
  const lastRenderTimeRef = useRef(0);

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

  // Textos acumulados em refs
  const accumulatedTranscriptRef = useRef('');
  const interimTranscriptRef = useRef('');

  // Analisador de áudio
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

  // Enviar áudio gravado para o servidor para transcrição robusta
  const transcribeAudioViaServer = async (blobToTranscribe) => {
    try {
      if (!blobToTranscribe || blobToTranscribe.size < 100) return '';
      setIsProcessing(true);
      setDiagnosticNote('Transcrevendo áudio no servidor...');

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

  // Transcrição silenciosa em segundo plano durante a fala (para navegadores sem WebSpeech nativo)
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

  // Polimento com IA (Gemini / Groq)
  const requestAiPolish = async (textToPolish) => {
    try {
      const key = aiApiKey || localStorage.getItem('voz_ai_key') || '';
      if (!key) return null;

      const response = await fetch('/api/ai-polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToPolish,
          apiKey: key,
          provider: aiProvider || 'gemini'
        })
      });

      const data = await response.json();
      if (data && data.success && data.polishedText) {
        return data.polishedText.trim();
      }
      return null;
    } catch (e) {
      console.warn('Erro ao polir com IA:', e);
      return null;
    }
  };

  // INICIAR GRAVAÇÃO
  const startRecording = async () => {
    try {
      accumulatedTranscriptRef.current = '';
      interimTranscriptRef.current = '';
      audioChunksRef.current = [];
      setLiveTranscription('');
      setElapsedSeconds(0);
      setCopied(false);
      setIsProcessing(false);
      setDiagnosticNote('');
      hasBrowserSpeechRef.current = false;
      isStreamingBusyRef.current = false;

      // 1. Obter áudio do microfone
      const audioConstraints = selectedDeviceId && selectedDeviceId !== 'default'
        ? { deviceId: { ideal: selectedDeviceId }, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
        : { echoCancellation: true, noiseSuppression: true, autoGainControl: true };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      mediaStreamRef.current = stream;

      isRecordingRef.current = true;
      setIsRecording(true);

      // 2. Configurar Analisador de Áudio Suave (Equalizador Musical de 5 Barras com Attack/Decay)
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioCtx;
        if (audioCtx.state === 'suspended') {
          await audioCtx.resume();
        }

        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        analyserRef.current = analyser;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        barsRef.current = [6, 6, 6, 6, 6];
        setAudioBars([6, 6, 6, 6, 6]);

        // 5 faixas de frequência musical para o equalizador
        const bands = [
          { start: 2, end: 8, max: 26 },    // Graves
          { start: 9, end: 18, max: 38 },   // Médios-graves
          { start: 19, end: 32, max: 48 },  // Voz principal (centro mais alto)
          { start: 33, end: 50, max: 38 },  // Médios-altos
          { start: 51, end: 75, max: 26 }   // Agudos
        ];

        const checkLevel = () => {
          if (!isRecordingRef.current || !analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          for (let i = 0; i < bands.length; i++) {
            const { start, end, max } = bands[i];
            let sum = 0;
            for (let j = start; j < end; j++) {
              sum += dataArray[j];
            }
            const avg = sum / (end - start);

            // Altura alvo da barra com base na energia da frequência
            const targetHeight = 6 + Math.min(max - 6, Math.round((avg / 130) * (max - 6)));

            // Física musical suave (Attack e Decay suave):
            // Sobe suavemente (Attack: 0.3) e desce devagarinho (Decay: 0.08)
            const current = barsRef.current[i];
            if (targetHeight > current) {
              barsRef.current[i] = current + (targetHeight - current) * 0.30;
            } else {
              barsRef.current[i] = current + (targetHeight - current) * 0.08;
            }
          }

          const now = performance.now();
          if (now - lastRenderTimeRef.current > 33) {
            lastRenderTimeRef.current = now;
            setAudioBars([...barsRef.current]);
          }

          animFrameRef.current = requestAnimationFrame(checkLevel);
        };
        checkLevel();
      } catch (err) {
        console.warn('Erro ao inicializar analisador de áudio:', err);
      }

      // 3. Configurar MediaRecorder
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

      // 4. Reconhecimento de Voz do Navegador
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

      // 5. Streaming contínuo a cada 2s para preenchimento em tempo real em qualquer navegador
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

  // PARAR GRAVAÇÃO E FORMATAR O TEXTO (COM DUPLO MOTOR E IA)
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

    // 1. Limpar loop de análise de áudio
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setAudioBars([6, 6, 6, 6, 6]);

    // 2. Parar reconhecimento de voz
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }

    // 3. Obter o áudio gravado
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

    // 4. Parar tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // 5. Coleta do texto capturado
    let spokenText = (
      accumulatedTranscriptRef.current + (interimTranscriptRef.current ? ' ' + interimTranscriptRef.current : '')
    ).trim();

    if (!spokenText && liveTranscription) {
      spokenText = liveTranscription.trim();
    }

    // 6. Transcrição completa no servidor
    if (capturedBlob) {
      setDiagnosticNote('Processando texto final no servidor...');
      const serverText = await transcribeAudioViaServer(capturedBlob);
      if (serverText) {
        spokenText = serverText;
      }
    }

    // 7. APLICA FORMATAÇÃO INTELIGENTE (LOCAL + IA)
    if (spokenText) {
      // Pontuação inteligente local (sempre imediata)
      let polishedText = formatAndPolishSpeech(spokenText);

      // Se a IA estiver ativa e tiver chave configurada, aprimora com IA
      const key = aiApiKey || localStorage.getItem('voz_ai_key') || '';
      if (aiEnabled && key) {
        setDiagnosticNote('Arrumando texto e pontuação com IA ✨...');
        const aiResult = await requestAiPolish(spokenText);
        if (aiResult) {
          polishedText = aiResult;
        }
      }

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
    setAudioBars([6, 6, 6, 6, 6]);
  };

  // Re-transcrever áudio manualmente
  const handleRetranscribe = async () => {
    if (!audioBlob) return;
    setIsProcessing(true);
    setDiagnosticNote('Transcrevendo áudio gravado no servidor...');
    try {
      const result = await transcribeAudioViaServer(audioBlob);
      if (result) {
        let polished = formatAndPolishSpeech(result);
        const key = aiApiKey || localStorage.getItem('voz_ai_key') || '';
        if (aiEnabled && key) {
          setDiagnosticNote('Arrumando texto com IA ✨...');
          const aiRes = await requestAiPolish(result);
          if (aiRes) polished = aiRes;
        }
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

  // Arrumar com IA manualmente pelo botão no texto
  const handleManualAiPolish = async () => {
    if (!finalText.trim()) return;

    const key = aiApiKey || localStorage.getItem('voz_ai_key') || '';
    if (!key) {
      setSettingsTab('ia');
      setIsSettingsOpen(true);
      showToast('Insira sua chave gratuita da IA nas configurações para começar ✨');
      return;
    }

    setIsAiPolishing(true);
    setDiagnosticNote('Arrumando texto e pontuação com IA ✨...');
    try {
      const aiResult = await requestAiPolish(finalText);
      if (aiResult) {
        setFinalText(aiResult);
        showToast('Texto aprimorado com sucesso pela IA! ✨');
      } else {
        showToast('Não foi possível conectar à IA. Verifique sua chave nas configurações.');
      }
    } catch {
      showToast('Erro ao processar com IA.');
    } finally {
      setIsAiPolishing(false);
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
    } catch {
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
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  // BAIXAR ARQUIVO .TXT
  const handleDownloadTxt = () => {
    if (!finalText.trim()) return;
    const blob = new Blob([finalText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voz-transcricao-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Download do arquivo de texto iniciado! 💾');
  };

  // RESETAR TELA
  const handleReset = () => {
    setFinalText('');
    setLiveTranscription('');
    setAudioUrl(null);
    setAudioBlob(null);
    setRecordedDuration(0);
    setDiagnosticNote('');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-slate-200">
      {/* TOAST FLUTUANTE */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs px-4 py-2 rounded-full shadow-lg transition-all">
          {toastMessage}
        </div>
      )}

      {/* CABEÇALHO */}
      <header className="w-full max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg text-slate-900 tracking-tight">Voz</span>
          <span className="text-[11px] text-slate-400 font-normal">gravador & transcrição</span>
        </div>

        <button
          type="button"
          onClick={() => {
            setSettingsTab('audio');
            setIsSettingsOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-colors"
          title="Abrir configurações de microfone e IA"
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
              Fale naturalmente. O equalizador acompanha o som e o texto é pontuado e organizado ao parar.
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

            {/* EQUALIZADOR SUAVE EM REPOUSO */}
            <div className="mt-6 flex items-center justify-center gap-1.5 h-10 px-4 py-1.5 rounded-xl bg-slate-100/70 border border-slate-200/60">
              {[6, 6, 6, 6, 6].map((h, i) => (
                <div key={i} className="w-2 h-1.5 rounded-full bg-slate-300" />
              ))}
            </div>
            <span className="text-[10px] text-slate-400 mt-1.5">Microfone pronto para falar</span>
          </div>
        )}

        {/* ESTADO 2: GRAVANDO (COM EQUALIZADOR MUSICAL SUAVE DE 5 BARRAS) */}
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

            {/* EQUALIZADOR MUSICAL SUAVE DE 5 BARRAS (SOBE E DESCE DEVAGARINHO COM FÍSICA NATURAL) */}
            <div className="my-5 flex items-center justify-center gap-2 h-16 px-6 py-2 rounded-2xl bg-slate-100/80 border border-slate-200/90 shadow-inner">
              {audioBars.map((height, idx) => (
                <div
                  key={idx}
                  className={`w-2.5 rounded-full transition-all duration-75 ease-out ${
                    height > 10
                      ? 'bg-gradient-to-t from-emerald-500 via-teal-400 to-sky-500 shadow-xs'
                      : 'bg-slate-300'
                  }`}
                  style={{
                    height: `${Math.round(height)}px`,
                  }}
                />
              ))}
            </div>

            {/* AVISO DE DIAGNÓSTICO */}
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
                Aperte <strong>Parar</strong> para finalizar e aplicar a pontuação automática.
              </div>
            </div>
          </div>
        )}

        {/* ESTADO 3: PROCESSANDO FINALIZAÇÃO */}
        {isProcessing && (
          <div className="w-full flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-slate-700 animate-spin" />
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
                <div className="flex items-center gap-2">
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

                  {/* BOTÃO ARRUMAR COM IA */}
                  <button
                    type="button"
                    onClick={handleManualAiPolish}
                    disabled={isAiPolishing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-900 rounded-lg text-xs font-medium transition-colors"
                    title="Pontuar, organizar e corrigir com IA"
                  >
                    {isAiPolishing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                        <span>Arrumando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        <span>Arrumar com IA</span>
                      </>
                    )}
                  </button>
                </div>

                {/* BOTÕES SECUNDÁRIOS */}
                <div className="flex items-center gap-1">
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
        <span>Áudio e IA integrados para transcrição precisa</span>
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
        initialTab={settingsTab}
        aiEnabled={aiEnabled}
        setAiEnabled={setAiEnabled}
        aiProvider={aiProvider}
        setAiProvider={setAiProvider}
        aiApiKey={aiApiKey}
        setAiApiKey={setAiApiKey}
      />
    </div>
  );
}
