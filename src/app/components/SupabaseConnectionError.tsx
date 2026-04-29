import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function SupabaseConnectionError() {
  const handleRefresh = () => {
    window.location.reload();
  };

  const openSupabase = () => {
    window.open('https://supabase.com/dashboard', '_blank');
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full border-red-200 shadow-lg">
        <CardHeader className="border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <CardTitle className="text-xl text-red-900">
                Error de Conexión a Supabase
              </CardTitle>
              <p className="text-sm text-red-700 mt-1">
                No se pudo conectar con la base de datos
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Posibles causas */}
          <div>
            <h3 className="font-semibold text-zinc-900 mb-3">Posibles causas:</h3>
            <ul className="space-y-2 text-sm text-zinc-700">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>El proyecto de Supabase está <strong>pausado</strong> (los proyectos gratuitos se pausan después de 7 días de inactividad)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>Problemas de <strong>conexión a internet</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-0.5">•</span>
                <span>El proyecto de Supabase fue <strong>eliminado o movido</strong></span>
              </li>
            </ul>
          </div>

          {/* Soluciones */}
          <div>
            <h3 className="font-semibold text-zinc-900 mb-3">Soluciones:</h3>
            <ol className="space-y-3 text-sm text-zinc-700">
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 mt-0.5">1.</span>
                <div>
                  <p className="font-medium">Verifica tu conexión a internet</p>
                  <p className="text-xs text-zinc-500 mt-1">Asegúrate de tener conexión estable</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 mt-0.5">2.</span>
                <div>
                  <p className="font-medium">Reactiva tu proyecto en Supabase</p>
                  <p className="text-xs text-zinc-500 mt-1">Ve al dashboard de Supabase y haz clic en "Resume project"</p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-emerald-600 mt-0.5">3.</span>
                <div>
                  <p className="font-medium">Recarga la página</p>
                  <p className="text-xs text-zinc-500 mt-1">Después de reactivar el proyecto, recarga esta página</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Información técnica */}
          <div className="p-4 bg-zinc-100 rounded-lg border border-zinc-200">
            <h4 className="font-semibold text-zinc-900 text-sm mb-2">Información técnica:</h4>
            <div className="space-y-1 text-xs font-mono text-zinc-600">
              <p>Proyecto: dtpffryregemqlkogdhg</p>
              <p>URL: https://dtpffryregemqlkogdhg.supabase.co</p>
              <p>Error: TypeError: Failed to fetch</p>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
            <Button
              onClick={openSupabase}
              variant="outline"
              className="flex-1"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Abrir Supabase Dashboard
            </Button>
            <Button
              onClick={handleRefresh}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Recargar Página
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
