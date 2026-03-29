import { AlertCircle, Database, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { useState } from 'react';

export function SQLSetupGuide() {
  const [copied, setCopied] = useState(false);

  const handleCopySQL = () => {
    // Copiar el contenido del archivo SQL al portapapeles
    fetch('/supabase_reset_schema.sql')
      .then(response => response.text())
      .then(text => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <CardHeader className="bg-gradient-to-r from-red-500 to-red-600 text-white">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl">Configuración de Base de Datos Requerida</CardTitle>
              <p className="text-red-100 mt-1">El sistema de créditos necesita nuevas tablas en Supabase</p>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="p-6 space-y-6">
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                  Tablas Nuevas Requeridas
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  El sistema de créditos necesita las siguientes tablas:
                </p>
                <ul className="list-disc list-inside text-sm text-yellow-800 dark:text-yellow-200 mt-2 space-y-1">
                  <li><code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">customers</code> - Información de clientes</li>
                  <li><code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">credit_payments</code> - Registro de abonos</li>
                  <li>Nuevos campos en <code className="bg-yellow-100 dark:bg-yellow-900 px-1 rounded">invoices</code> - is_credit, credit_balance</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-sm">1</span>
              Abrir SQL Editor en Supabase
            </h3>
            <ol className="space-y-3 ml-8 text-sm">
              <li className="flex items-start gap-2">
                <span className="font-semibold text-green-600">•</span>
                <div>
                  <p>Ve a tu proyecto en <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline inline-flex items-center gap-1">
                    Supabase Dashboard <ExternalLink className="h-3 w-3" />
                  </a></p>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-green-600">•</span>
                <p>En el menú lateral izquierdo, haz clic en <strong>"SQL Editor"</strong></p>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-semibold text-green-600">•</span>
                <p>Haz clic en el botón <strong>"+ New query"</strong></p>
              </li>
            </ol>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-sm">2</span>
              Copiar y Ejecutar el Script SQL
            </h3>
            <div className="ml-8 space-y-3">
              <Button
                onClick={handleCopySQL}
                className="w-full"
                variant={copied ? "default" : "outline"}
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    ¡Script Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copiar Script SQL al Portapapeles
                  </>
                )}
              </Button>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-green-600">•</span>
                  <p>Haz clic en el botón de arriba para copiar el script automáticamente</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-green-600">•</span>
                  <p>Pega el script completo en el editor SQL de Supabase (Ctrl+V o Cmd+V)</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-green-600">•</span>
                  <p>Haz clic en el botón <strong>"Run"</strong> o presiona Ctrl+Enter</p>
                </li>
              </ol>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-green-600 text-white text-sm">3</span>
              Recargar la Página
            </h3>
            <div className="ml-8 space-y-3 text-sm">
              <p>Una vez que el script se ejecute correctamente:</p>
              <ol className="space-y-2">
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-green-600">•</span>
                  <p>Verás un mensaje de éxito en Supabase</p>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-semibold text-green-600">•</span>
                  <p>Recarga esta página para que el sistema funcione correctamente</p>
                </li>
              </ol>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-100">
                  ⚠️ ADVERTENCIA IMPORTANTE
                </h3>
                <p className="text-sm text-red-800 dark:text-red-200 mt-1">
                  Este script eliminará TODOS los datos existentes y recreará las tablas desde cero. 
                  Asegúrate de tener respaldos si tienes datos importantes.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                  Ubicación del Script
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                  El script SQL completo se encuentra en: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">/supabase_reset_schema.sql</code>
                </p>
                <p className="text-sm text-blue-800 dark:text-blue-200 mt-2">
                  También puedes descargarlo manualmente desde el repositorio del proyecto.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t flex justify-between items-center">
            <a
              href="https://supabase.com/docs/guides/database"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              Documentación de Supabase
              <ExternalLink className="h-3 w-3" />
            </a>
            <Button onClick={() => window.location.reload()}>
              Recargar Página
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
