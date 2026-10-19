import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  Square, 
  Copy, 
  Check, 
  Settings, 
  RotateCcw, 
  Volume2, 
  VolumeX, 
  Download, 
  Trash2, 
  Sparkles,
  Play,
  Pause
} from 'lucide-react';
import SettingsModal from './components/SettingsModal';
import { playChime } from './utils/audioUtils';

export default function App() {
  // Configurações
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(() => {
    return localStorage.getItem('voxscript_mic_device_id') || '';
  });
  const [language, setLanguage] = useState('pt-BR');
  const [appendMode, setAppendMode] = useState(false); // Por padrão, cada fala gera um texto novo e limpo!
  const [soundEffectsEnabled, setSoundEffectsEnabled] = useState(true);

  // Estados de Gravação
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Áudio e Transcrição
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

  // Referências
  const mediaRecorderRef = useRef(null);
  const recognitionRef = useRef(null);
  const isRecordingRef = useRef(false);
  const timerIntervalRef = useRef(null);
  const accumulatedTranscriptRef = useRef('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2800);
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

  // Timer
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

  // INICIAR GRAVAÇÃO (Estilo Google: clique no microfone)
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

      // MediaRecorder para manter o microfone ativo
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.start(500);

      // Speech Recognition
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
          console.warn('SpeechRecognition error:', event.error);
        };

        recognition.onend = () => {
          if (isRecordingRef.current) {
            try { recognition.start(); } catch (e) {}
          }
        };

        recognitionRef.current = recognition;
        try { recognition.start(); } catch (e) {}
      } else {
        alert('Seu navegador não suporta a API de fala nativa. Recomendamos usar o Google Chrome ou Edge.');
      }

      isRecordingRef.current = true;
      setIsRecording(true);

      if (soundEffectsEnabled) playChime('start');
    } catch (err) {
      console.error('Erro ao iniciar:', err);
      alert('Não foi possível acessar o microfone. Verifique as permissões do navegador.');
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

      // Adiciona ao histórico da sessão
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
      showToast('Nenhuma fala foi detectada. Tente falar mais perto do microfone.');
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
      showToast('Texto copiado para a área de transferência! 📋');
      setTimeout(() => setCopied(false), 2500);
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

  // BAIXAR .TXT
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
    showToast('Arquivo .txt baixado!');
  };

  // LIMPAR E RECOMEÇAR
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-violet-600 selection:text-white font-sans">
      {/* Toast flutuante */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-slate-900 border border-violet-500/50 text-white text-xs sm:text-sm font-medium shadow-2xl shadow-violet-500/20 animate-in fade-in slide-in-from-top-3 duration-200">
          {toastMessage}
        </div>
      )}

      {/* CABEÇALHO CLEAN E MINIMALISTA */}
      <header className="w-full max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-600 flex items-center justify-center text-white shadow-md shadow-violet-600/30">
            <Mic className="w-4 h-4" />
          </div>
          <span className="font-bold text-lg tracking-tight text-white">VoxScript</span>
        </div>

        {/* Botão de Configurações (Microfone, Idioma, Histórico em outra tela) */}
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          disabled={isRecording}
          title="Configurações e escolha de microfone"
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition-all active:scale-95 shadow-sm"
        >
          <Settings className="w-4 h-4 text-violet-400" />
          <span className="hidden sm:inline font-medium">Configurações</span>
        </button>
      </header>

      {/* TELA PRINCIPAL (ESTILO GOOGLE: SUPER CLEAN) */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-6 flex flex-col items-center justify-center -mt-6">
        {/* CASO 1: NENHUM TEXTO AINDA E NÃO GRAVANDO (TELA INICIAL PURA) */}
        {!isRecording && !text && (
          <div className="flex flex-col items-center text-center animate-in fade-in duration-300">
            <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
              O que você quer dizer?
            </h1>
            <p className="text-sm text-slate-400 mb-10 max-w-sm">
              Toque no microfone, fale o que quiser e o texto aparecerá pronto para copiar.
            </p>

            {/* BOTÃO CENTRAL DE MICROFONE GIGANTE */}
            <div className="relative group">
              <div className="absolute -inset-4 rounded-full bg-violet-600/20 blur-xl group-hover:bg-violet-600/30 transition-all duration-300"></div>
              <button
                type="button"
                onClick={startRecording}
                className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-violet-600 to-indigo-500 hover:from-violet-500 hover:to-indigo-400 text-white flex items-center justify-center shadow-2xl shadow-violet-600/40 active:scale-95 transition-all duration-200"
                title="Clique para falar"
              >
                <Mic className="w-12 h-12 text-white" />
              </button>
            </div>

            <span className="text-xs text-slate-500 mt-6 font-medium">
              Clique no microfone para começar
            </span>
          </div>
        )}

        {/* CASO 2: GRAVANDO (FEEDBACK VISUAL LIMPO TIPO GOOGLE VOICE SEARCH) */}
        {isRecording && (
          <div className="flex flex-col items-center text-center animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-8">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-sm font-semibold text-red-400 uppercase tracking-widest">
                Ouvindo você...
              </span>
              <span className="font-mono text-sm text-slate-400 ml-2">
                {formatSeconds(elapsedSeconds)}
              </span>
            </div>

            {/* ONDAS CONCÊNTRICAS PULSANTES */}
            <div className="relative flex items-center justify-center mb-10">
              <div className="absolute w-44 h-44 rounded-full bg-red-500/10 animate-ping"></div>
              <div className="absolute w-36 h-36 rounded-full bg-red-500/20 animate-pulse"></div>

              {/* Botão Parar no Centro */}
              <button
                type="button"
                onClick={stopRecording}
                className="relative z-10 w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white flex flex-col items-center justify-center shadow-2xl shadow-red-600/50 active:scale-95 transition-all"
                title="Clique para parar e ver o texto"
              >
                <Square className="w-9 h-9 fill-white mb-1" />
                <span className="text-[11px] font-bold tracking-wider uppercase">Parar</span>
              </button>
            </div>

            {/* PRÉVIA DA FALA EM TEMPO REAL */}
            {interimText ? (
              <p className="text-base sm:text-lg text-slate-200 font-medium italic max-w-md px-4 leading-relaxed animate-in fade-in">
                "{interimText}"
              </p>
            ) : (
              <p className="text-sm text-slate-400">
                Pode falar normalmente...
              </p>
            )}

            <button
              type="button"
              onClick={stopRecording}
              className="mt-8 px-5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white transition-colors"
            >
              Terminei de falar
            </button>
          </div>
        )}

        {/* CASO 3: DEPOIS DE FALAR -> APARECE O TEXTO PRONTO PARA COPIAR! */}
        {!isRecording && text && (
          <div className="w-full flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-300">
            {/* CARD DO TEXTO TRANSCRIÇÃO */}
            <div className="w-full bg-slate-900/90 border border-slate-800/90 rounded-3xl p-6 shadow-2xl backdrop-blur-xl flex flex-col gap-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs text-slate-400">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Texto Transcrito
                </span>
                <span>{text.split(/\s+/).filter(Boolean).length} palavras</span>
              </div>

              {/* Caixa de Texto Editável */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                className="w-full bg-transparent text-slate-100 text-base sm:text-lg leading-relaxed outline-none resize-none font-sans placeholder-slate-600"
                placeholder="Seu texto transcrito aparecerá aqui..."
              />

              {/* BARRA DE AÇÃO PRINCIPAL COM O BOTÃO DE COPIAR */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                {/* BOTÃO COPIAR (DESTAQUE MÁXIMO) */}
                <button
                  type="button"
                  onClick={handleCopy}
                  className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all shadow-xl active:scale-95 ${
                    copied
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                      : 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/30'
                  }`}
                  title="Copiar texto para área de transferência"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 text-white" />
                      <span>Copiado com sucesso!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 text-white" />
                      <span>Copiar Texto</span>
                    </>
                  )}
                </button>

                {/* AÇÕES COMPLEMENTARES CLEAN */}
                <div className="flex items-center gap-2 self-center">
                  <button
                    type="button"
                    onClick={handleSpeakText}
                    title={isSpeaking ? 'Parar leitura' : 'Ouvir texto'}
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    {isSpeaking ? <VolumeX className="w-4 h-4 text-amber-400" /> : <Volume2 className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadTxt}
                    title="Baixar como .txt"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={handleReset}
                    title="Limpar e gravar novo"
                    className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* BOTÃO PARA FALAR NOVAMENTE ABAIXO DO TEXTO */}
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-violet-500/50 text-slate-200 text-xs sm:text-sm font-semibold transition-all shadow-md active:scale-95"
              >
                <Mic className="w-4 h-4 text-violet-400" />
                <span>Gravar Novamente</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-xs text-slate-400 hover:text-slate-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Nova fala limpa</span>
              </button>
            </div>
          </div>
        )}
      </main>

      {/* RODAPÉ DISCRETO */}
      <footer className="w-full max-w-4xl mx-auto px-6 py-4 flex items-center justify-between text-[11px] text-slate-600">
        <span>VoxScript • Áudio processado localmente no seu navegador</span>
        <button
          type="button"
          onClick={() => setIsSettingsOpen(true)}
          className="hover:text-slate-400 transition-colors"
        >
          Opções & Microfone
        </button>
      </footer>

      {/* TELA DE CONFIGURAÇÕES ESCONDIDA EM MODAL */}
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
        onSelectHistoryItem={(histText) => setText(histText)}
        onClearHistory={() => setHistory([])}
      />
    </div>
  );
}
