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
  RotateCcw
} from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import { playChime } from './utils/audioUtils';

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    return localStorage.getItem('voxscript_mic_device_id') || '';
  });
  const [language, setLanguage] = useState('pt-BR');
  const [appendMode, setAppendMode] = useState(false);
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Transcrição
  const [mediaStream, setMediaStream] = useState(null);
  const [text, setText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [copied, setCopied] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Histórico na Sessão
  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem('voxscript_session_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const timerIntervalRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleSelectDevice = (deviceId) => {
    setSelectedDeviceId(deviceId);
    localStorage.setItem('voxscript_mic_device_id', deviceId);
  };

  useEffect(() => {
    try {
      localStorage.setItem('voxscript_session_history', JSON.stringify(history));
    } catch (e) {}
  }, [history]);

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
      accumulatedTranscriptRef.current = '';
      setInterimText('');
      setElapsedSeconds(0);
      setCopied(false);

      const audioConstraints = selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, echoCancellation: true, noiseSuppression: true }
        : { echoCancellation: true, noiseSuppression: true };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints });
      setMediaStream(stream);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.start(500);

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
          console.warn('Reconhecimento de fala:', event.error);
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try { recognition.start(); } catch (e) {}
          }
        };

        recognitionRef.current = recognition;
        try { recognition.start(); } catch (e) {}
      } else {
        alert('Seu navegador não possui suporte ao reconhecimento nativo. Recomendamos Google Chrome ou Edge.');
      }

      isRecordingRef.current = true;
      setIsRecording(true);

      if (soundEffectsEnabled) playChime('start');
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
      stopRecordingCleanup();
    }
  };

  // PARAR GRAVAÇÃO E MOSTRAR O TEXTO
  const stopRecording = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    const duration = elapsedSeconds;

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch (e) {}
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) {}
    }

    const sessionTranscription = (
      accumulatedTranscriptRef.current + (interimText ? ' ' + interimText : '')
    ).trim();

    setInterimText('');

    if (sessionTranscription) {
      setText((prev) => {
        if (!prev || !appendMode) return sessionTranscription;
        return prev + '\n\n' + sessionTranscription;
      });

      setHistory((prev) => [
        {
          id: Date.now().toString(),
          text: sessionTranscription,
          duration,
          timestamp: new Date().toISOString()
        },
        ...prev.slice(0, 19)
      ]);
    } else {
      showToast('Nenhuma fala foi capturada. Tente novamente.');
    }

    if (soundEffectsEnabled) playChime('stop');
  };

  const stopRecordingCleanup = () => {
    isRecordingRef.current = false;
    setIsRecording(false);
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
      setMediaStream(null);
    }
  };

  // COPIAR TEXTO
  const handleCopy = async () => {
    if (!text.trim()) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      showToast('Texto copiado!');
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
    if (!text.trim()) return;

    const u = new SpeechSynthesisUtterance(text);
    u.lang = language;
    u.onstart = () => setIsSpeaking(true);
    u.onend = () => setIsSpeaking(false);
    u.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(u);
  };

  // BAIXAR ARQUIVO
  const handleDownloadTxt = () => {
    if (!text.trim()) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcricao-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Arquivo baixado!');
  };

  const handleReset = () => {
    setText('');
    setInterimText('');
    setCopied(false);
    if (isSpeaking && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-slate-800 flex flex-col justify-between font-sans">
      {/* Toast discreto */}
      {toastMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-md transition-all">
          {toastMessage}
        </div>
      )}

      {/* CABEÇALHO LIMPO (SEM ÍCONES EM QUADRADOS ARREDONDADOS) */}
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

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 w-full max-w-xl mx-auto px-6 flex flex-col items-center justify-center -mt-8">
        {/* ESTADO 1: INICIAL LIMPO */}
        {!isRecording && !text && (
          <div className="flex flex-col items-center text-center">
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900 mb-1">
              Toque no microfone para falar
            </h1>
            <p className="text-xs text-slate-500 mb-8">
              O que você falar será transformado em texto pronto para copiar.
            </p>

            {/* BOTÃO DE MICROFONE NATURAL E DISCRETO */}
            <button
              type="button"
              onClick={startRecording}
              className="w-20 h-20 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center shadow-sm active:scale-95 transition-all"
              title="Clique para falar"
            >
              <Mic className="w-8 h-8" />
            </button>
          </div>
        )}

        {/* ESTADO 2: OUVINDO (FEEDBACK LIMPO) */}
        {isRecording && (
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center gap-2 mb-6">
              <span className="w-2 h-2 rounded-full bg-red-600"></span>
              <span className="text-xs font-medium text-red-600 uppercase tracking-wider">
                Ouvindo...
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {formatSeconds(elapsedSeconds)}
              </span>
            </div>

            {/* BOTÃO PARAR */}
            <button
              type="button"
              onClick={stopRecording}
              className="w-20 h-20 rounded-full bg-red-600 hover:bg-red-700 text-white flex flex-col items-center justify-center shadow-sm active:scale-95 transition-all mb-6"
              title="Clique para parar"
            >
              <Square className="w-6 h-6 fill-white mb-0.5" />
              <span className="text-[10px] font-semibold uppercase">Parar</span>
            </button>

            {/* PRÉVIA DO TEXTO AO VIVO */}
            {interimText ? (
              <p className="text-base text-slate-700 font-normal italic max-w-md px-4">
                "{interimText}"
              </p>
            ) : (
              <p className="text-xs text-slate-400">
                Fale agora no microfone...
              </p>
            )}
          </div>
        )}

        {/* ESTADO 3: TEXTO PRONTO APÓS A FALA */}
        {!isRecording && text && (
          <div className="w-full flex flex-col items-center">
            <div className="w-full bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-2 border-b border-slate-100">
                <span className="font-medium text-slate-700">Texto transcrito</span>
                <span>{text.split(/\s+/).filter(Boolean).length} palavras</span>
              </div>

              {/* TEXTO TRANSRITO EDITÁVEL */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                className="w-full bg-transparent text-slate-800 text-base leading-relaxed outline-none resize-none font-sans"
              />

              {/* BOTÕES DE AÇÃO */}
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
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copiado!' : 'Copiar texto'}</span>
                </button>

                {/* BOTÕES SECUNDÁRIOS */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleSpeakText}
                    title={isSpeaking ? 'Parar leitura' : 'Ouvir texto'}
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    {isSpeaking ? <VolumeX className="w-4 h-4 text-red-600" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    title="Baixar arquivo de texto"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    title="Limpar texto"
                    className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* BOTÃO FALAR NOVAMENTE */}
            <div className="mt-5 flex items-center gap-3">
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

      {/* RODAPÉ DISCRETO */}
      <footer className="w-full max-w-3xl mx-auto px-6 py-4 flex items-center justify-between text-[11px] text-slate-400">
        <span>Voz</span>
        <span>Áudio processado no seu navegador</span>
      </footer>

      {/* CONFIGURAÇÕES (MODAL SEPARADO) */}
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
        onSelectHistoryItem={(h) => setText(h)}
        onClearHistory={() => setHistory([])}
      />
    </div>
  );
}
