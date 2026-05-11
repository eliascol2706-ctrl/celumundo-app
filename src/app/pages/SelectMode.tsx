import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { LogIn, Search } from 'lucide-react';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { registerDevice, checkDeviceAuthorization } from '../lib/device-auth';

export function SelectMode() {
  const navigate = useNavigate();
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [selectedMode, setSelectedMode] = useState<'login' | 'consultation' | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  // Verificar si el dispositivo ya está autorizado al cargar
  useEffect(() => {
    const checkDevice = async () => {
      const isAuthorized = await checkDeviceAuthorization();
      setIsChecking(false);
      // No redirigimos automáticamente, siempre mostramos las opciones
    };
    checkDevice();
  }, []);

  const handleModeSelection = async (mode: 'login' | 'consultation') => {
    // Verificar si el dispositivo ya está autorizado
    const isAuthorized = await checkDeviceAuthorization();

    if (isAuthorized) {
      // Si ya está autorizado, redirigir directamente
      if (mode === 'login') {
        navigate('/login');
      } else {
        navigate('/consulta-productos');
      }
    } else {
      // Si no está autorizado, pedir contraseña
      setSelectedMode(mode);
      setIsPasswordDialogOpen(true);
    }
  };

  const handlePasswordSubmit = async () => {
    if (password !== 'vip2024') {
      toast.error('Contraseña incorrecta');
      return;
    }

    // Registrar el dispositivo
    const registered = await registerDevice();

    if (!registered) {
      toast.error('Error al registrar el dispositivo');
      return;
    }

    toast.success('Dispositivo autorizado');
    setIsPasswordDialogOpen(false);
    setPassword('');

    // Redirigir según el modo seleccionado
    if (selectedMode === 'login') {
      navigate('/login');
    } else {
      navigate('/consulta-productos');
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Verificando dispositivo...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
              CELUMUNDO VIP
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Sistema de Gestión Integral
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Opción 1: Ingresar al Sistema */}
            <Card
              className="cursor-pointer transition-all hover:shadow-xl hover:scale-105 border-2 hover:border-blue-500"
              onClick={() => handleModeSelection('login')}
            >
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
                    <LogIn className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Ingresar al Sistema
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Accede a todas las funcionalidades del sistema de gestión
                </p>
              </CardContent>
            </Card>

            {/* Opción 2: Consulta de Productos */}
            <Card
              className="cursor-pointer transition-all hover:shadow-xl hover:scale-105 border-2 hover:border-green-500"
              onClick={() => handleModeSelection('consultation')}
            >
              <CardContent className="p-8 text-center">
                <div className="flex justify-center mb-6">
                  <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full">
                    <Search className="h-12 w-12 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  Consulta de Productos
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  Escanea códigos de barras o QR para consultar precios y disponibilidad
                </p>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500 dark:text-gray-400">
            <p>© 2024 CELUMUNDO VIP - Sistema de Gestión Integral</p>
          </div>
        </div>
      </div>

      {/* Dialog para contraseña */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autorización Requerida</DialogTitle>
            <DialogDescription>
              Ingresa la contraseña para autorizar este dispositivo
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handlePasswordSubmit();
                  }
                }}
                placeholder="Ingresa la contraseña"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsPasswordDialogOpen(false);
                setPassword('');
                setSelectedMode(null);
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handlePasswordSubmit}>
              Autorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
