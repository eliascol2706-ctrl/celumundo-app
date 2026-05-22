import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

export function OfflineScreen() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [reconnecting, setReconnecting] = useState(false);
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => {
      setIsOffline(false);
      setReconnecting(false);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    if (!isOffline) return;
    const interval = setInterval(() => setPulseCount(c => c + 1), 2000);
    return () => clearInterval(interval);
  }, [isOffline]);

  const handleRetry = () => {
    setReconnecting(true);
    setTimeout(() => {
      if (navigator.onLine) {
        setIsOffline(false);
      }
      setReconnecting(false);
    }, 2000);
  };

  if (!isOffline) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Animated background rings */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <div
          className="w-96 h-96 rounded-full border border-emerald-900/30 animate-ping"
          style={{ animationDuration: '3s' }}
        />
        <div
          className="absolute w-72 h-72 rounded-full border border-emerald-800/20 animate-ping"
          style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}
        />
      </div>

      <div className="relative max-w-sm w-full">
        {/* Card */}
        <div className="bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
          {/* Top accent */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-700 via-emerald-500 to-emerald-700" />

          <div className="p-8 text-center space-y-6">
            {/* Icon container */}
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-inner">
                  <WifiOff className="w-9 h-9 text-zinc-400" />
                </div>
                {/* Pulse dot */}
                <span
                  key={pulseCount}
                  className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-zinc-900 animate-ping"
                  style={{ animationDuration: '1s', animationIterationCount: '1' }}
                />
                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-zinc-900" />
              </div>
            </div>

            {/* Text */}
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-zinc-100 tracking-tight">
                Sin conexión a internet
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                CELUMUNDO VIP requiere conexión activa para operar. Verifica tu red y vuelve a intentarlo.
              </p>
            </div>

            {/* Status indicator */}
            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 bg-zinc-800/60 rounded-lg px-4 py-2.5 border border-zinc-700/50">
              <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span>Estado: Desconectado</span>
            </div>

            {/* Retry button */}
            <button
              onClick={handleRetry}
              disabled={reconnecting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors duration-150 shadow-lg shadow-emerald-900/30"
            >
              <RefreshCw className={`w-4 h-4 ${reconnecting ? 'animate-spin' : ''}`} />
              {reconnecting ? 'Verificando conexión...' : 'Reintentar conexión'}
            </button>

            <p className="text-xs text-zinc-600">
              La pantalla se cerrará automáticamente al restablecer la conexión.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
