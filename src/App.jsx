import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Sparkles, 
  Volume2, 
  FileAudio, 
  ShieldCheck, 
  Layers, 
  Info
} from 'lucide-react';
import MicrophoneSelector from './components/MicrophoneSelector';
import AudioVisualizer from './components/AudioVisualizer';
import AudioPlayer from './components/AudioPlayer';
import TranscriptionEditor from './components/TranscriptionEditor';
import RecordingControls from './components/RecordingControls';
import HistoryDrawer from './components/HistoryDrawer';
import { playChime } from './utils/audioUtils';

export default function App() {
  // Configurações do Microfone
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    return localStorage.getItem('voxscript_mic_device_id') || '';
  });

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [language, setLanguage] = useState('pt-BR');
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);

  // Estados de Áudio
  const [mediaStream, setMediaStream] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordedDuration, setRecordedDuration] = useState(0);

  // Estados de Transcrição
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [appendMode, setAppendMode] = useState(true);

  // Histórico de Gravações na Sessão
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('voxscript_session_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Suporte a Speech Recognition
  const [speechSupported, setSpeechSupported] = useState(true);

  // Referências
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const timerIntervalRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');

  // Salva microfone escolhido no localStorage
  const handleSelectDevice = (deviceId) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('voxscript_mic_device_id', deviceId);
  };

  // Verifica suporte ao SpeechRecognition no navegador
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Salva histórico no localStorage
  useEffect(() => {
    try {
      localStorage.setItem('voxscript_session_history', JSON.stringify(history));
    } catch (e) {
      console.warn('Falha ao salvar histórico no localStorage:', e);
    }
  }, [history]);

  // Timer de gravação
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isRecording, isPaused]);

  // INICIAR GRAVAÇÃO
  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      accumulatedTranscriptRef.current = '';
      setInterimText('');
      setElapsedSeconds(0);

      // 1. Obter Stream de Áudio do Microfone Selecionado
      const audioConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });
      setMediaStream(stream);

      // 2. Configurar MediaRecorder
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
        const type = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.current, { type });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      recorder.start(250); // coleta fatias a cada 250ms

      // 3. Configurar SpeechRecognition
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onresult = (event) => {
          let currentInterim = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              accumulatedTranscriptRef.current += (accumulatedTranscriptRef.current ? ' ' : '') + transcript.trim();
            } else {
              currentInterim += transcript;
            }
          }
          setInterimText(currentInterim);
        };

        recognition.onerror = (event) => {
          console.warn('Evento de erro SpeechRecognition:', event.error);
          if (event.error === 'not-allowed') {
            alert('Acesso ao reconhecimento de voz bloqueado. Permita o microfone no navegador.');
          }
        };

        recognition.onend = () => {
          // Se ainda deve estar gravando (ex: timeout de silêncio do navegador), reinicia automaticamente
          if (isRecordingRef.current) {
            try {
              recognition.start();
            } catch (e) {
              // Já iniciado ou em processo de encerramento
            }
          }
        };

        recognitionRef.current = recognition;
        try {
          recognition.start();
        } catch (e) {
          console.error('Erro ao iniciar reconhecimento:', e);
        }
      }

      isRecordingRef.current = true;
      setIsRecording(true);
      setIsPaused(false);

      if (soundEffectsEnabled) {
        playChime('start');
      }
    } catch (err) {
      console.error('Falha ao iniciar gravação:', err);
      alert('Não foi possível iniciar a gravação. Verifique as permissões de microfone do navegador.');
      stopRecordingCleanup();
    }
  };

  // PARAR GRAVAÇÃO E TRANSCREVER
  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsPaused(false);

    // Salva a duração final gravada
    const finalSeconds = elapsedSeconds;
    setRecordedDuration(finalSeconds);

    // 1. Parar MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        console.error('Erro ao parar gravador:', e);
      }
    }

    // 2. Parar Tracks do Stream
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }

    // 3. Parar SpeechRecognition e Consolidar Texto
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error('Erro ao parar reconhecimento:', e);
      }
    }

    // Concatena texto final acumulado com qualquer resíduo interino
    const sessionTranscription = (
      accumulatedTranscriptRef.current + (interimText ? ' ' + interimText : '')
    ).trim();

    setInterimText('');

    if (sessionTranscription) {
      setText((prev) => {
        if (!prev || !appendMode) {
          return sessionTranscription;
        }
        return prev + '\n\n' + sessionTranscription;
      });

      // Adiciona ao Histórico
      const newHistoryItem = {
        id: Date.now().toString(),
        text: sessionTranscription,
        duration: finalSeconds,
        timestamp: new Date().toISOString()
      };
      setHistory((prev) => [newHistoryItem, ...prev.slice(0, 19)]);
    }

    if (soundEffectsEnabled) {
      playChime('stop');
    }
  };

  // PAUSAR / RETOMAR GRAVAÇÃO
  const togglePause = () => {
    if (!isRecording || !mediaRecorderRef.current) return;

    if (isPaused) {
      // Retomar
      try {
        mediaRecorderRef.current.resume();
        if (recognitionRef.current) {
          recognitionRef.current.start();
        }
      } catch (e) {}
      setIsPaused(false);
    } else {
      // Pausar
      try {
        mediaRecorderRef.current.pause();
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      } catch (e) {}
      setIsPaused(true);
    }
  };

  const stopRecordingCleanup = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    setIsPaused(false);
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      setMediaStream(null);
    }
  };

  return (
    <div className="ambient-bg min-h-screen flex flex-col justify-between selection:bg-violet-600 selection:text-white">
      {/* CABEÇALHO */}
      <header className="w-full border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-violet-600/30">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                  VoxScript
                </span>
                <span className="px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/30 text-[10px] text-violet-300 font-semibold tracking-wide uppercase">
                  Voz para Texto
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Grave pelo microfone e copie a transcrição em segundos
              </p>
            </div>
          </div>

          {/* Botão de Escolha do Microfone */}
          <div className="flex items-center gap-2">
            <MicrophoneSelector
              selectedDeviceId={selectedDeviceId}
              onSelectDevice={handleSelectDevice}
              isRecording={isRecording}
            />
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 flex-1">
        {/* Aviso de compatibilidade se SpeechRecognition não estiver disponível */}
        {!speechSupported && (
          <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-700/50 text-amber-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg">
            <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Aviso de Compatibilidade de Reconhecimento</p>
              <p className="text-amber-300/80 mt-1">
                A API Web Speech nativa tem melhor desempenho no <strong>Google Chrome</strong>, <strong>Microsoft Edge</strong>, <strong>Safari</strong> ou navegadores Chromium. Você ainda poderá gravar e reproduzir o áudio normalmente em qualquer navegador.
              </p>
            </div>
          </div>
        )}

        {/* Visualizador de Ondas Sonoras da Voz */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span className="font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
              Espectro de Frequência da Voz
            </span>
            <span>Taxa: 48kHz • Estéreo</span>
          </div>
          <AudioVisualizer
            stream={mediaStream}
            isRecording={isRecording}
            isPaused={isPaused}
          />
        </section>

        {/* Controles Principais de Gravação (Botão Gravar/Parar, Timer, Idioma) */}
        <section className="glass-panel rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col items-center">
          <RecordingControls
            isRecording={isRecording}
            isPaused={isPaused}
            onStartRecording={startRecording}
            onStopRecording={stopRecording}
            onTogglePause={togglePause}
            elapsedSeconds={elapsedSeconds}
            language={language}
            setLanguage={setLanguage}
            soundEffectsEnabled={soundEffectsEnabled}
            setSoundEffectsEnabled={setSoundEffectsEnabled}
          />

          {/* Dica de uso */}
          <p className="text-xs text-slate-500 text-center mt-3 max-w-md">
            Pressione <strong>Iniciar Gravação</strong>, fale normalmente e clique em <strong>Parar Gravação</strong> quando terminar para transcrever o áudio em texto.
          </p>
        </section>

        {/* Player do Áudio Gravado (aparece após parar a gravação se houver áudio) */}
        {audioUrl && (
          <section className="animate-in fade-in slide-in-from-top-3 duration-200">
            <AudioPlayer
              audioBlob={audioBlob}
              audioUrl={audioUrl}
              recordedDuration={recordedDuration}
            />
          </section>
        )}

        {/* Editor de Texto Transcrito com Botão de Cópia e Ferramentas */}
        <section>
          <TranscriptionEditor
            text={text}
            setText={setText}
            interimText={interimText}
            isRecording={isRecording}
            appendMode={appendMode}
            setAppendMode={setAppendMode}
          />
        </section>

        {/* Histórico da Sessão */}
        <section>
          <HistoryDrawer
            history={history}
            onSelectHistoryItem={(itemText) => {
              setText((prev) => (prev ? prev + '\n\n' + itemText : itemText));
            }}
            onClearHistory={() => setHistory([])}
          />
        </section>
      </main>

      {/* RODAPÉ */}
      <footer className="w-full border-t border-slate-900 bg-slate-950/80 py-4 mt-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">VoxScript</span>
            <span>• Gravador de Voz & Transcrição Web</span>
          </div>

          <div className="flex items-center gap-4">
            <a
              href="https://github.com/wellingtonpereira12/voice-to-text"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 hover:text-slate-300 transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
              <span>GitHub</span>
            </a>
            <span className="text-slate-700">|</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              Áudio processado no navegador
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
