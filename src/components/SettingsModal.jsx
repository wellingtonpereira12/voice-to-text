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
  Sliders,
  Sparkles,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2
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
  onClearHistory,
  initialTab = 'audio',
  aiEnabled,
  setAiEnabled,
  aiProvider,
  setAiProvider,
  aiApiKey,
  setAiApiKey
}) {
  const [activeTab, setActiveTab] = useState(initialTab); // 'audio', 'ia', 'history'
  const [devices, setDevices] = useState([]);
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [copiedHistoryId, setCopiedHistoryId] = useState(null);

  // Estados da aba IA
  const [showKey, setShowKey] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState(null);

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
      setActiveTab(initialTab || 'audio');
      loadAudioDevices(false);
      setAiTestResult(null);
    } else {
      stopMicrophoneTest();
    }
  }, [isOpen, initialTab]);

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
      setIsTesting(true);
      const constraints = selectedDeviceId && selectedDeviceId !== 'default'
        ? { deviceId: { exact: selectedDeviceId } }
        : true;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
      testStreamRef.current = stream;

      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioCtx;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateTestLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let max = 0;
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > max) max = dataArray[i];
        }
        setAudioLevel(Math.min(100, Math.round((max / 150) * 100)));
        animFrameRef.current = requestAnimationFrame(updateTestLevel);
      };
      updateTestLevel();
    } catch (err) {
      console.error('Erro ao testar microfone:', err);
      setIsTesting(false);
    }
  };

  const handleCopyHistory = (e, text, id) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedHistoryId(id);
    setTimeout(() => setCopiedHistoryId(null), 2000);
  };

  // Testar chave de IA
  const handleTestAiKey = async () => {
    setTestingAi(true);
    setAiTestResult(null);

    try {
      const sample = 'ola amigo beleza tudo bem eu gostaria de saber se a ia do programa ta funcionando';
      const res = await fetch('/api/ai-polish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sample,
          apiKey: aiApiKey?.trim() || undefined,
          provider: aiProvider || 'gemini'
        })
      });

      const data = await res.json();
      if (data && data.success && data.polishedText) {
        setAiTestResult({ success: true, text: data.polishedText });
      } else {
        setAiTestResult({ success: false, error: data?.error || 'Erro ao conectar à API da IA.' });
      }
    } catch (err) {
      setAiTestResult({ success: false, error: err.message });
    } finally {
      setTestingAi(false);
    }
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
            <p className="text-xs text-slate-500">Ajuste suas preferências do programa</p>
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
            onClick={() => setActiveTab('ia')}
            className={`pb-2.5 px-3 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'ia'
                ? 'border-slate-900 text-slate-900 font-semibold'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>IA & Pontuação</span>
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
                        onClick={() => onSelectDevice(device.deviceId)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs flex items-center justify-between transition-colors ${
                          isSelected ? 'bg-slate-900 text-white font-medium' : 'text-slate-700 hover:bg-slate-200/60'
                        }`}
                      >
                        <span className="truncate pr-2">{device.label || `Microfone ${idx + 1}`}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Testador do microfone selecionado */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-700">Testar captação do microfone</span>
                <button
                  type="button"
                  onClick={toggleMicrophoneTest}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                    isTesting ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {isTesting ? 'Parar teste' : 'Falar para testar'}
                </button>
              </div>

              {isTesting && (
                <div className="flex items-center gap-2 pt-1">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-75"
                      style={{ width: `${audioLevel}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 w-8 text-right">{audioLevel}%</span>
                </div>
              )}
            </div>

            {/* Idioma */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">
                Idioma do reconhecimento de voz
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-slate-400"
              >
                {languages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Opções Gerais */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                <span>Acumular novos áudios no mesmo texto</span>
                <input
                  type="checkbox"
                  checked={appendMode}
                  onChange={(e) => setAppendMode(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-0"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-700 cursor-pointer">
                <span>Sons de início e parada</span>
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

        {/* Conteúdo Aba IA & Pontuação */}
        {activeTab === 'ia' && (
          <div className="space-y-4 text-sm">
            {/* Ativar/Desativar IA */}
            <div className="p-3 bg-amber-50/60 border border-amber-200/80 rounded-lg flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-900 block">Arrumar texto com IA</span>
                <span className="text-[11px] text-slate-500">Adiciona pontuação, parágrafos e corrige repetições da fala</span>
              </div>
              <input
                type="checkbox"
                checked={aiEnabled}
                onChange={(e) => {
                  setAiEnabled(e.target.checked);
                  localStorage.setItem('voz_ai_enabled', e.target.checked ? 'true' : 'false');
                }}
                className="rounded border-amber-300 text-slate-900 focus:ring-0 w-4 h-4"
              />
            </div>

            {/* Provedor de IA */}
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1">
                Provedor de IA (Modelos Gratuitos)
              </label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  setAiProvider(e.target.value);
                  localStorage.setItem('voz_ai_provider', e.target.value);
                }}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 outline-none focus:border-slate-400"
              >
                <option value="gemini">Google Gemini 2.5 Flash (Padrão Ativo - Grátis)</option>
                <option value="groq">Groq Llama 3.3 70B (Grátis)</option>
              </select>
            </div>

            {/* Input da Chave da API */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-700">
                  Chave de API
                </label>
                <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Chave padrão já ativa
                </span>
              </div>
              <div className="relative flex items-center">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={aiApiKey}
                  onChange={(e) => {
                    setAiApiKey(e.target.value);
                    localStorage.setItem('voz_ai_key', e.target.value.trim());
                  }}
                  placeholder="Chave padrão já configurada no servidor (ou cole sua própria chave)"
                  className="w-full pl-2.5 pr-8 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 font-mono outline-none focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 text-slate-400 hover:text-slate-600"
                  title={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Links de ajuda para obter a chave grátis */}
              <div className="mt-2 text-[11px] text-slate-500 space-y-1">
                {aiProvider === 'gemini' ? (
                  <p>
                    👉 <a 
                      href="https://aistudio.google.com/apikey" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                    >
                      Clique aqui para gerar sua chave grátis no Google AI Studio
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <br />
                    <span className="text-slate-400">É gratuito com sua conta Google e não pede cartão de crédito.</span>
                  </p>
                ) : (
                  <p>
                    👉 <a 
                      href="https://console.groq.com/keys" 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-blue-600 hover:underline font-medium inline-flex items-center gap-1"
                    >
                      Clique aqui para gerar sua chave grátis no Groq Console
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                    <br />
                    <span className="text-slate-400">Gratuito e muito rápido para processar texto.</span>
                  </p>
                )}
              </div>
            </div>

            {/* Botão de teste da chave */}
            <div>
              <button
                type="button"
                onClick={handleTestAiKey}
                disabled={testingAi || !aiApiKey?.trim()}
                className="w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                {testingAi ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
                    <span>Testando conexão com a IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>Testar Validade da Chave</span>
                  </>
                )}
              </button>

              {aiTestResult && (
                <div className={`mt-2 p-2.5 rounded-lg text-xs ${
                  aiTestResult.success ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'
                }`}>
                  {aiTestResult.success ? (
                    <div>
                      <span className="font-semibold block mb-0.5">✅ Chave válida e funcionando!</span>
                      <p className="text-[11px] text-emerald-700 italic">"{aiTestResult.text}"</p>
                    </div>
                  ) : (
                    <div>
                      <span className="font-semibold block">❌ Falha no teste:</span>
                      <span className="text-[11px]">{aiTestResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <p className="text-[11px] text-slate-400 pt-1">
              * Mesmo sem chave, o sistema conta com pontuação automática inteligente de conectivos e perguntas.
            </p>
          </div>
        )}

        {/* Conteúdo Aba Histórico */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs text-slate-500">
                Últimas falas gravadas nesta sessão
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={onClearHistory}
                  className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Limpar</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">
                  Nenhum áudio gravado ainda nesta sessão.
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
