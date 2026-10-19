import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Mic, 
  Volume2, 
  Globe, 
  Check, 
  RefreshCw, 
  Trash2, 
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
    { code: 'pt-BR', label: 'Português (Brasil)' },
    { code: 'en-US', label: 'English (US)' },
    { code: 'es-ES', label: 'Español' },
    { code: 'fr-FR', label: 'Français' },
    { code: 'de-DE', label: 'Deutsch' },
    { code: 'it-IT', label: 'Italiano' },
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
      {/* Backdrop suave */}
      <div 
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Janela de Configurações */}
      <div className="relative w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg p-6 z-10 text-slate-800">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-base text-slate-900">Configurações</h3>
            <p className="text-xs text-slate-500">Ajuste suas preferências de áudio</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Abas */}
        <div className="flex border-b border-slate-200 mt-4 mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('audio')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors ${
              activeTab === 'audio'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Microfone & Idioma
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Histórico</span>
            {history.length > 0 && (
              <span className="text-[11px] text-slate-400">({history.length})</span>
            )}
          </button>
        </div>

        {/* Conteúdo Aba Microfone */}
        {activeTab === 'audio' && (
          <div className="space-y-4 text-sm">
            {/* Escolha do Microfone */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-slate-700">
                  Microfone de entrada
                </label>
                <button
                  type="button"
                  onClick={() => loadAudioDevices(true)}
                  className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Atualizar</span>
                </button>
              </div>

              <div className="space-y-1 max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-1 bg-slate-50">
                {devices.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => loadAudioDevices(true)}
                    className="w-full py-2.5 text-xs text-blue-600 hover:underline text-center"
                  >
                    Clique aqui para autorizar o microfone
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
                        className={`w-full px-3 py-2 text-xs rounded-md flex items-center justify-between text-left transition-colors ${
                          isSelected
                            ? 'bg-white border border-slate-300 font-medium text-slate-900 shadow-xs'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <span className="truncate">{device.label || `Microfone ${idx + 1}`}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-slate-800 shrink-0 ml-2" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Teste de Volume */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-600">Teste do microfone</span>
                <button
                  type="button"
                  onClick={toggleMicrophoneTest}
                  className="text-xs px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                >
                  {isTesting ? 'Parar' : 'Testar'}
                </button>
              </div>
              <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-slate-700 transition-all duration-75"
                  style={{ width: `${audioLevel}%` }}
                />
              </div>
            </div>

            {/* Idioma */}
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Idioma do áudio
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-slate-400"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Opções */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                <span>Acumular texto ao falar novamente</span>
                <input
                  type="checkbox"
                  checked={appendMode}
                  onChange={(e) => setAppendMode(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                <span>Efeitos sonoros (bips suaves)</span>
                <input
                  type="checkbox"
                  checked={soundEffectsEnabled}
                  onChange={(e) => setSoundEffectsEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0"
                />
              </label>
            </div>
          </div>
        )}

        {/* Conteúdo Aba Histórico */}
        {activeTab === 'history' && (
          <div>
            <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
              <span>Transcrições desta sessão</span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Limpar histórico da sessão?')) onClearHistory();
                  }}
                  className="text-red-600 hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {history.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-400">
                  Nenhuma gravação anterior nesta sessão.
                </div>
              ) : (
                history.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    onClick={() => {
                      onSelectHistoryItem(item.text);
                      onClose();
                    }}
                    className="p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 cursor-pointer flex items-start justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-slate-400 block mb-0.5">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <p className="text-xs text-slate-700 line-clamp-2">
                        {item.text}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleCopyHistory(e, item.text, item.id || idx)}
                      className="p-1 text-slate-400 hover:text-slate-700 rounded"
                    >
                      {copiedHistoryId === (item.id || idx) ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
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

        {/* Fechar */}
        <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
}
