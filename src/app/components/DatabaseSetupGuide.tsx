import { AlertCircle, Database, ArrowRight } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

export function DatabaseSetupGuide() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-blue-50">
      <Card className="max-w-3xl w-full shadow-2xl">
        <CardHeader className="text-center bg-red-50 border-b-4 border-red-500">
          <div className="flex justify-center mb-4">
            <AlertCircle className="h-16 w-16 text-red-500" />
          </div>
          <CardTitle className="text-3xl text-red-700">
            ⚠️ Base de Datos No Configurada
          </CardTitle>
          <p className="text-lg text-red-600 mt-2">
            El sistema no puede conectarse a Supabase porque la base de datos no ha sido inicializada
          </p>
        </CardHeader>
        
        <CardContent className="p-8 space-y-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-6 rounded-r-lg">
            <h3 className="font-bold text-lg text-blue-900 mb-3 flex items-center gap-2">
              <Database className="h-5 w-5" />
              Solución Rápida (5 minutos)
            </h3>
            <p className="text-blue-800 mb-4">
              Sigue estos pasos para configurar la base de datos y comenzar a usar CELUMUNDO VIP:
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 bg-white border-2 border-green-200 rounded-lg hover:border-green-400 transition-all">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                1
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-1">Abrir Supabase Dashboard</h4>
                <p className="text-gray-700 mb-3">
                  Ingresa a tu proyecto de Supabase
                </p>
                <Button
                  onClick={() => window.open('https://app.supabase.com/', '_blank')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Ir a Supabase Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white border-2 border-blue-200 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">
                2
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-1">Abrir SQL Editor</h4>
                <p className="text-gray-700">
                  En el menú lateral izquierdo, haz clic en <strong>SQL Editor</strong>
                </p>
                <p className="text-gray-700 mt-2">
                  Luego haz clic en el botón <strong className="text-green-600">+ New Query</strong>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white border-2 border-purple-200 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">
                3
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-1">Copiar el Script SQL</h4>
                <p className="text-gray-700 mb-3">
                  Abre el archivo <code className="bg-gray-100 px-2 py-1 rounded font-mono text-sm">/supabase_reset_schema.sql</code> que está en la raíz de tu proyecto
                </p>
                <p className="text-gray-700">
                  Copia <strong>TODO</strong> el contenido del archivo (es un script largo, asegúrate de copiar todo desde el inicio hasta el final)
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white border-2 border-orange-200 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold">
                4
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-1">Pegar y Ejecutar</h4>
                <p className="text-gray-700">
                  Pega el contenido copiado en el editor SQL de Supabase
                </p>
                <p className="text-gray-700 mt-2">
                  Haz clic en el botón <strong className="text-green-600">Run</strong> o presiona <kbd className="bg-gray-100 px-2 py-1 rounded text-sm">Ctrl+Enter</kbd>
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 bg-white border-2 border-green-200 rounded-lg">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">
                5
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-gray-900 mb-1">Recargar la Página</h4>
                <p className="text-gray-700 mb-3">
                  Una vez que el script termine de ejecutarse (verás un mensaje de éxito), recarga esta página
                </p>
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Recargar Página
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 rounded-r-lg">
            <h4 className="font-bold text-yellow-900 mb-2">📝 Nota Importante</h4>
            <p className="text-yellow-800 text-sm">
              El script SQL creará todas las tablas necesarias y cargará datos de ejemplo para que puedas empezar a usar el sistema inmediatamente.
            </p>
            <p className="text-yellow-800 text-sm mt-2">
              <strong>Usuarios de ejemplo:</strong>
            </p>
            <ul className="text-yellow-800 text-sm mt-1 ml-6 list-disc">
              <li>Admin: <code className="bg-yellow-100 px-2 py-0.5 rounded">admin</code> / <code className="bg-yellow-100 px-2 py-0.5 rounded">admin1</code></li>
              <li>Vendedor: <code className="bg-yellow-100 px-2 py-0.5 rounded">seller</code> / <code className="bg-yellow-100 px-2 py-0.5 rounded">seller1</code></li>
            </ul>
          </div>

          <div className="bg-gray-50 border-2 border-gray-300 p-6 rounded-lg">
            <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Database className="h-4 w-4" />
              ¿Necesitas Ayuda?
            </h4>
            <p className="text-gray-700 text-sm">
              Si tienes problemas configurando la base de datos, verifica:
            </p>
            <ul className="text-gray-700 text-sm mt-2 ml-6 list-disc space-y-1">
              <li>Que copiaste TODO el contenido del archivo SQL (no solo una parte)</li>
              <li>Que tu proyecto de Supabase esté activo</li>
              <li>Que tengas permisos de administrador en Supabase</li>
              <li>La consola del navegador (F12) para ver mensajes de error detallados</li>
            </ul>
          </div>

          <div className="text-center pt-4">
            <p className="text-sm text-gray-600">
              Una vez configurada la base de datos, podrás usar todas las funcionalidades de
            </p>
            <p className="text-xl font-bold text-green-600 mt-1">
              CELUMUNDO VIP - Sistema de IDs Únicas
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
