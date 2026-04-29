import { Component, ReactNode } from 'react';
import { SupabaseConnectionError } from './SupabaseConnectionError';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // Si es un error de Supabase (Failed to fetch), mostrar componente específico
      if (
        this.state.error.message.includes('Failed to fetch') ||
        this.state.error.message.includes('NetworkError') ||
        this.state.error.message.includes('fetch')
      ) {
        return <SupabaseConnectionError />;
      }

      // Para otros errores, mostrar error genérico
      return (
        <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
            <h1 className="text-xl font-bold text-red-600 mb-2">Error en la Aplicación</h1>
            <p className="text-zinc-700 mb-4">{this.state.error.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Recargar Página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
