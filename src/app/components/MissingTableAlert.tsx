import { AlertTriangle, Database, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface MissingTableAlertProps {
  tableName: string;
  migrationFile?: string;
}

export function MissingTableAlert({ tableName, migrationFile = 'migration_add_returns_table.sql' }: MissingTableAlertProps) {
  return (
    <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400">
          <AlertTriangle className="h-5 w-5" />
          Tabla "{tableName}" No Encontrada
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          La tabla <code className="bg-gray-200 dark:bg-gray-800 px-2 py-1 rounded font-mono text-xs">{tableName}</code> no existe en tu base de datos de Supabase. 
          Sigue estos pasos para crearla:
        </p>

        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <div className="bg-orange-600 dark:bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
              1
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Abre Supabase Dashboard</p>
              <p className="text-xs text-muted-foreground mt-1">
                Ve a{' '}
                <a 
                  href="https://app.supabase.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-orange-600 dark:text-orange-400 hover:underline font-medium"
                >
                  https://app.supabase.com/
                </a>
                {' '}y selecciona tu proyecto
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="bg-orange-600 dark:bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
              2
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Abre SQL Editor</p>
              <p className="text-xs text-muted-foreground mt-1">
                En el menú lateral, haz clic en <strong>SQL Editor</strong> → <strong>New Query</strong>
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="bg-orange-600 dark:bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
              3
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Copia el script SQL</p>
              <p className="text-xs text-muted-foreground mt-1">
                Abre el archivo <code className="bg-gray-200 dark:bg-gray-800 px-1 rounded font-mono">{migrationFile}</code> en el proyecto y copia todo su contenido
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="bg-orange-600 dark:bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
              4
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Ejecuta el script</p>
              <p className="text-xs text-muted-foreground mt-1">
                Pega el contenido en el SQL Editor y haz clic en <strong>Run</strong>
              </p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <div className="bg-orange-600 dark:bg-orange-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 text-sm font-bold">
              5
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-900 dark:text-gray-100">Recarga la página</p>
              <p className="text-xs text-muted-foreground mt-1">
                Una vez ejecutado el script exitosamente, recarga esta página
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
          <div className="flex gap-2">
            <Database className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-blue-800 dark:text-blue-300">
              <strong>Nota:</strong> Este proceso es seguro y no afectará tus datos existentes. 
              Solo agregará la tabla faltante a tu base de datos.
            </div>
          </div>
        </div>

        <Button 
          onClick={() => window.location.reload()} 
          className="w-full"
          variant="outline"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          Ya ejecuté el script - Recargar página
        </Button>
      </CardContent>
    </Card>
  );
}
