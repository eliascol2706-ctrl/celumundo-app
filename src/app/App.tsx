import { useState, useEffect } from 'react';
import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { SplashScreen } from './components/SplashScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SupabaseConnectionError } from './components/SupabaseConnectionError';
import { supabase } from './lib/supabase';

export default function App() {
  const [showSplash, setShowSplash] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);

  useEffect(() => {
    // Verificar conexión a Supabase al inicio
    const checkConnection = async () => {
      try {
        const { error } = await supabase.from('departments').select('count').limit(1);
        if (error) {
          console.error('Supabase connection error:', error);
          setConnectionError(true);
        }
      } catch (error) {
        console.error('Failed to connect to Supabase:', error);
        setConnectionError(true);
      } finally {
        setCheckingConnection(false);
      }
    };

    checkConnection();

    // Verificar si hay un flag de login exitoso
    const justLoggedIn = sessionStorage.getItem('justLoggedIn');
    if (justLoggedIn === 'true') {
      setShowSplash(true);
      sessionStorage.removeItem('justLoggedIn');
    }
  }, []);

  const handleSplashComplete = () => {
    setShowSplash(false);
  };

  // Mostrar loader mientras verifica conexión
  if (checkingConnection) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-zinc-700">Conectando a la base de datos...</p>
        </div>
      </div>
    );
  }

  // Mostrar error si no se pudo conectar
  if (connectionError) {
    return <SupabaseConnectionError />;
  }

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  return (
    <ErrorBoundary>
      <RouterProvider router={router} />
      <Toaster />
    </ErrorBoundary>
  );
}
