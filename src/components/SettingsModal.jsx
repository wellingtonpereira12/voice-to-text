import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  Volume2, 
  Globe, 
  History, 
  Settings, 
  Check, 
  RefreshCw, 
  Trash2, 
  Clock, 
  Copy,
  Sliders
} from 'lucide-react';

export default function SettingsModal({
  isOpen,
  onClose,
  selectedDeviceId,
  onSelectDevice,
  language,
  setLanguage,
  appendMode,
  setAppendMode,
  soundEffectsEnabled,
  setSoundEffectsEnabled,
  history,
  onSelectHistoryItem,
  onClearHistory
}) {
  const [activeTab, setActiveTab] = useState('audio'); // 'audio', 'history'
  const [devices, setDevices] = useState([]);
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [copiedHistoryId, setCopiedHistoryId] = useState(null);

  const testStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const languages = [
    { code: 'pt-BR', label: 'Português (Brasil)', flag: '🇧🇷' },
    { code: 'en-US', label: 'English (US)', flag: '🇺🇸' },
    { code: 'es-ES', label: 'Español', flag: '🇪🇸' },
    { code: 'fr-FR', label: 'Français', flag: '🇫🇷' },
    { code: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
    { code: 'it-IT', label: 'Italiano', flag: '🇮🇹' },
  ];

  const loadAudioDevices = async (requestPermission = false) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;

      if (requestPermission) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          tempStream.getTracks().forEach(t => t.stop());
        } catch (err) {
          console.warn('Permissão de microfone não concedida:', err);
        }
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
      setDevices(audioInputs);

      if (audioInputs.length > 0 && !selectedDeviceId) {
        onSelectDevice(audioInputs[0].deviceId);
      }
    } catch (err) {
      console.error('Erro ao buscar microfones:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAudioDevices(false);
    } else {
      stopMicrophoneTest();
    }
  }, [isOpen]);

  const stopMicrophoneTest = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (testStreamRef.current) {
      testStreamRef.current.getTracks().forEach(t => t.stop());
      testStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    setIsTesting(false);
    setAudioLevel(0);
  };

  const toggleMicrophoneTest = async () => {
    if (isTesting) {
      stopMicrophoneTest();
      return;
    }

    try {
      const constraints = {
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      testStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      setIsTesting(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error('Erro ao testar microfone:', err);
      alert('Não foi possível acessar o microfone para teste.');
      stopMicrophoneTest();
    }
  };

  const handleCopyHistory = async (e, text, id) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedHistoryId(id);
      setTimeout(() => setCopiedHistoryId(null), 2000);
    } catch (err) {}
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop com desfoque */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      />

      {/* Conteúdo do Modal */}
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-100">Configurações</h3>
              <p className="text-xs text-slate-400">Ajuste o microfone e preferências</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex gap-2 my-4 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'audio'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Microfone & Fala
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'history'
                ? 'bg-violet-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Histórico</span>
            {history.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] font-mono">
                {history.length}
              </span>
            )}
          </button>
        </div>

        {/* Conteúdo da Aba Áudio */}
        {activeTab === 'audio' && (
          <div className="space-y-4">
            {/* Escolha do Microfone */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-violet-400" />
                  Qual microfone usar?
                </label>
                <button
                  type="button"
                  onClick={() => loadAudioDevices(true)}
                  className="text-[11px] text-slate-400 hover:text-violet-400 flex items-center gap-1 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Atualizar</span>
                </button>
              </div>

              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {devices.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => loadAudioDevices(true)}
                    className="w-full p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 text-xs text-violet-300 hover:bg-slate-800 transition-colors text-center font-medium"
                  >
                    Permitir acesso ao microfone
                  </button>
                ) : (
                  devices.map((device, idx) => {
                    const isSelected = (device.deviceId === selectedDeviceId) || (!selectedDeviceId && idx === 0);
                    return (
                      <button
                        key={device.deviceId || idx}
                        type="button"
                        onClick={() => {
                          onSelectDevice(device.deviceId);
                          if (isTesting) stopMicrophoneTest();
                        }}
                        className={`w-full p-2.5 rounded-xl text-xs flex items-center justify-between text-left transition-all ${
                          isSelected
                            ? 'bg-violet-600/20 border border-violet-500 text-white font-medium'
                            : 'bg-slate-950/60 hover:bg-slate-800 border border-slate-800 text-slate-300'
                        }`}
                      >
                        <span className="truncate mr-2">{device.label || `Microfone ${idx + 1}`}</span>
                        {isSelected && <Check className="w-4 h-4 text-violet-400 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Testador de Volume */}
            <div className="p-3 bg-slate-950/60 rounded-2xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                  Teste de volume do microfone
                </span>
                <button
                  type="button"
                  onClick={toggleMicrophoneTest}
                  className={`text-[11px] px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    isTesting
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {isTesting ? 'Parar Teste' : 'Testar Mic'}
                </button>
              </div>

              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-sky-500 to-violet-500 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                <span>0%</span>
                <span>Fale para testar: {audioLevel}%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Idioma da Fala */}
            <div className="pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 mb-2">
                <Globe className="w-3.5 h-3.5 text-violet-400" />
                Idioma do reconhecimento de voz
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 outline-none focus:border-violet-500 cursor-pointer"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.flag} {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Modo de adição & sons */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Acumular texto ao falar novamente</span>
                <input
                  type="checkbox"
                  checked={appendMode}
                  onChange={(e) => setAppendMode(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-violet-500"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Efeitos sonoros (bips de início/fim)</span>
                <input
                  type="checkbox"
                  checked={soundEffectsEnabled}
                  onChange={(e) => setSoundEffectsEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-violet-600 focus:ring-violet-500"
                />
              </label>
            </div>
          </div>
        )}

        {/* Conteúdo da Aba Histórico */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-slate-400">Transcrições salvas nesta sessão</span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Deseja limpar todo o histórico?')) onClearHistory();
                  }}
                  className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpar tudo</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  Nenhuma transcrição gravada ainda nesta sessão.
                </div>
              ) : (
                history.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      onSelectHistoryItem(item.text);
                      onClose();
                    }}
                    className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-slate-800/80 hover:border-violet-500/50 cursor-pointer transition-all flex items-start justify-between gap-3 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        {item.duration > 0 && <span>• {item.duration}s</span>}
                      </div>
                      <p className="text-xs text-slate-200 line-clamp-2 leading-relaxed">
                        {item.text}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCopyHistory(e, item.text, item.id || idx)}
                      title="Copiar texto"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-violet-600 text-slate-300 hover:text-white shrink-0 transition-colors"
                    >
                      {copiedHistoryId === (item.id || idx) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Rodapé do Modal */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-lg shadow-violet-600/30 transition-all active:scale-95"
          >
            Pronto
          </button>
        </div>
      </div>
    </div>
  );
}
