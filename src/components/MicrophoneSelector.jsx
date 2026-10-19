import React, { useState, useEffect, useRef } from 'react';
import { Mic, Settings, Volume2, Check, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';

export default function MicrophoneSelector({
  selectedDeviceId,
  onSelectDevice,
  isRecording
}) {
  const [devices, setDevices] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [isTesting, setIsTesting] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const testStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  // Carrega lista de microfones
  const loadAudioDevices = async (requestPermission = false) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        console.warn('MediaDevices API não suportada neste navegador.');
        return;
      }

      if (requestPermission) {
        try {
          const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          setPermissionState('granted');
          // Para a stream temporária após obter os rótulos dos dispositivos
          tempStream.getTracks().forEach(t => t.stop());
        } catch (err) {
          console.error('Permissão de microfone negada:', err);
          setPermissionState('denied');
        }
      }

      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = allDevices.filter(d => d.kind === 'audioinput');

      // Se rótulos estiverem vazios, permissão ainda não foi concedida
      if (audioInputs.some(d => d.label !== '')) {
        setPermissionState('granted');
      }

      setDevices(audioInputs);

      // Se nenhum selecionado ou selecionado não existe mais, seleciona o primeiro
      if (audioInputs.length > 0) {
        const exists = audioInputs.some(d => d.deviceId === selectedDeviceId);
        if (!selectedDeviceId || !exists) {
          onSelectDevice(audioInputs[0].deviceId);
        }
      }
    } catch (err) {
      console.error('Erro ao listar microfones:', err);
    }
  };

  useEffect(() => {
    loadAudioDevices(false);

    // Escuta mudanças em dispositivos conectados (ex: fone conectado/desconectado)
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      const handleDeviceChange = () => loadAudioDevices(false);
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
      return () => {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      };
    }
  }, []);

  // Parar teste de microfone ao fechar ou desmontar
  const stopMicrophoneTest = () => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
    }
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

  useEffect(() => {
    if (!isOpen) {
      stopMicrophoneTest();
    }
  }, [isOpen]);

  // Iniciar teste de microfone para visualização de volume
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

        // Calcula média de amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        setAudioLevel(normalized);

        animFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error('Erro ao testar microfone:', err);
      alert('Não foi possível acessar o microfone para teste. Verifique as permissões do navegador.');
      stopMicrophoneTest();
    }
  };

  const currentDevice = devices.find(d => d.deviceId === selectedDeviceId);
  const currentLabel = currentDevice?.label || 'Microfone Padrão do Sistema';

  return (
    <div className="relative">
      {/* Botão de Abrir Seleção de Microfone */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isRecording}
        title="Clique para escolher qual microfone usar"
        className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all shadow-sm ${
          isRecording
            ? 'opacity-60 cursor-not-allowed bg-slate-900/60 border-slate-800 text-slate-400'
            : 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-700/80 hover:border-violet-500/50 text-slate-200 active:scale-95'
        }`}
      >
        <div className="relative">
          <Mic className="w-4 h-4 text-violet-400" />
          <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
        </div>
        <div className="flex flex-col text-left max-w-[200px] sm:max-w-[260px]">
          <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Microfone</span>
          <span className="truncate text-xs text-slate-100 font-medium">
            {currentLabel}
          </span>
        </div>
        <Settings className="w-3.5 h-3.5 text-slate-400 ml-1 opacity-70" />
      </button>

      {/* Modal / Dropdown de Configuração de Microfone */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 sm:left-0 top-full mt-2 w-80 sm:w-96 z-50 glass-panel-elevated rounded-2xl p-4 border border-slate-700/80 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-violet-400" />
                <h3 className="font-semibold text-sm text-slate-100">Escolher Microfone</h3>
              </div>
              <button
                type="button"
                onClick={() => loadAudioDevices(true)}
                title="Recarregar microfones e solicitar permissão"
                className="text-xs text-slate-400 hover:text-violet-400 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Atualizar</span>
              </button>
            </div>

            {/* Aviso se a permissão não foi dada */}
            {permissionState === 'denied' && (
              <div className="mb-3 p-2.5 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Acesso ao microfone bloqueado</p>
                  <p className="text-red-300/80 mt-0.5">
                    Permita o microfone no ícone de cadeado na barra de endereços do seu navegador.
                  </p>
                </div>
              </div>
            )}

            {/* Lista de Microfones */}
            <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
              {devices.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  <p>Nenhum microfone identificado.</p>
                  <button
                    type="button"
                    onClick={() => loadAudioDevices(true)}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-medium transition-colors"
                  >
                    Permitir Acesso
                  </button>
                </div>
              ) : (
                devices.map((device, index) => {
                  const isSelected = (device.deviceId === selectedDeviceId) || (!selectedDeviceId && index === 0);
                  const label = device.label || `Microfone ${index + 1} (Permissão pendente)`;

                  return (
                    <button
                      key={device.deviceId || index}
                      type="button"
                      onClick={() => {
                        onSelectDevice(device.deviceId);
                        if (isTesting) {
                          stopMicrophoneTest();
                        }
                      }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-violet-600/20 border border-violet-500/50 text-white font-semibold'
                          : 'bg-slate-800/40 hover:bg-slate-800/80 border border-transparent text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate mr-2">
                        <Mic className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-violet-400' : 'text-slate-400'}`} />
                        <span className="truncate">{label}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-violet-400 shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Teste de Volume em Tempo Real */}
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-slate-400" />
                  Teste de Áudio em Tempo Real
                </span>
                <button
                  type="button"
                  onClick={toggleMicrophoneTest}
                  className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    isTesting
                      ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                      : 'bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  {isTesting ? 'Parar Teste' : 'Testar Mic'}
                </button>
              </div>

              {/* Barra de Volume / VU Meter */}
              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700/50">
                <div
                  className="h-full rounded-full transition-all duration-75"
                  style={{
                    width: `${audioLevel}%`,
                    background: audioLevel > 75
                      ? 'linear-gradient(90deg, #10b981 0%, #f59e0b 60%, #ef4444 100%)'
                      : audioLevel > 30
                      ? 'linear-gradient(90deg, #10b981 0%, #3b82f6 100%)'
                      : '#10b981'
                  }}
                />
              </div>
              <div className="flex justify-between items-center text-[10px] text-slate-500 mt-1">
                <span>Silêncio</span>
                <span className="font-mono text-slate-400">{audioLevel}%</span>
                <span>Fale no microfone</span>
              </div>
            </div>

            {/* Fechar */}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
              >
                Concluir
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
