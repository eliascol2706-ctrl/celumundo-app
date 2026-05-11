import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, QrCode, X, Package } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { toast } from 'sonner';
import { supabase, getCurrentCompany } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';

interface Product {
  id: string;
  code: string;
  name: string;
  description: string;
  stock: number;
  current_cost: number;
  price1: number;
  price2: number;
  final_price: number;
}

export function ProductConsultation() {
  const navigate = useNavigate();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerType, setScannerType] = useState<'barcode' | 'qr' | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | Html5Qrcode | null>(null);

  const searchProduct = async (code: string) => {
    setIsLoading(true);
    try {
      const company = getCurrentCompany();

      // Buscar producto por código
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('company', company)
        .eq('code', code)
        .single();

      if (error || !data) {
        toast.error('Producto no encontrado');
        setProduct(null);
        return;
      }

      setProduct(data);
      toast.success('Producto encontrado');
    } catch (error) {
      console.error('Error searching product:', error);
      toast.error('Error al buscar producto');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    console.log('Código escaneado:', decodedText);

    // Detener el escáner
    if (scannerRef.current) {
      try {
        if (scannerRef.current instanceof Html5QrcodeScanner) {
          scannerRef.current.clear().catch(() => {});
        } else {
          scannerRef.current.stop().catch(() => {});
        }
      } catch (error) {
        // Ignorar errores
      }
      scannerRef.current = null;
    }

    // Si es código de barras, eliminar las letras "A"
    let processedCode = decodedText;
    if (scannerType === 'barcode') {
      processedCode = decodedText.replace(/A/g, '');
      console.log('Código procesado (sin A):', processedCode);
    }

    setIsScannerOpen(false);
    setScannerType(null);

    // Buscar el producto
    searchProduct(processedCode);
  };

  const handleScanError = (error: any) => {
    // Ignorar errores de escaneo continuo
    if (typeof error === 'string' && error.includes('NotFoundException')) {
      return;
    }
    // No mostrar nada, solo continuar escaneando
  };

  const startScanner = (type: 'barcode' | 'qr') => {
    setScannerType(type);
    setIsScannerOpen(true);
    setProduct(null);
  };

  const stopScanner = () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current instanceof Html5QrcodeScanner) {
          scannerRef.current.clear().catch(() => {});
        } else {
          scannerRef.current.stop().catch(() => {});
        }
      } catch (error) {
        // Ignorar errores al detener el escáner
      } finally {
        scannerRef.current = null;
      }
    }
    setIsScannerOpen(false);
    setScannerType(null);
  };

  useEffect(() => {
    if (isScannerOpen && scannerType) {
      // Esperar a que el DOM se actualice antes de inicializar el escáner
      const timeoutId = setTimeout(() => {
        const config = {
          fps: 10,
          qrbox: scannerType === 'qr' ? 250 : { width: 300, height: 150 },
          aspectRatio: scannerType === 'qr' ? 1.0 : 2.0,
          formatsToSupport: scannerType === 'qr'
            ? [0] // QR_CODE
            : [13, 8] // CODE_128, EAN_13
        };

        try {
          const element = document.getElementById('scanner-container');
          if (!element) {
            console.error('Scanner container not found');
            return;
          }

          // Usar Html5Qrcode directamente para mejor control
          const html5QrCode = new Html5Qrcode('scanner-container');
          scannerRef.current = html5QrCode;

          html5QrCode.start(
            { facingMode: 'environment' },
            config,
            handleScanSuccess,
            handleScanError
          ).catch((err) => {
            console.error('Error starting scanner:', err);

            // Limpiar la referencia
            scannerRef.current = null;

            // Mostrar mensaje específico según el tipo de error
            if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission denied')) {
              toast.error('Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.');
            } else if (err?.name === 'NotFoundError') {
              toast.error('No se encontró ninguna cámara en este dispositivo');
            } else if (err?.name === 'NotReadableError') {
              toast.error('La cámara está siendo usada por otra aplicación');
            } else {
              toast.error('No se pudo acceder a la cámara. Verifica los permisos.');
            }

            setIsScannerOpen(false);
            setScannerType(null);
          });
        } catch (error) {
          console.error('Error initializing scanner:', error);
          toast.error('Error al inicializar el escáner');
          stopScanner();
        }
      }, 100);

      return () => {
        clearTimeout(timeoutId);
        if (scannerRef.current) {
          try {
            if (scannerRef.current instanceof Html5QrcodeScanner) {
              scannerRef.current.clear().catch(() => {});
            } else {
              scannerRef.current.stop().catch(() => {});
            }
          } catch (error) {
            // Ignorar errores en cleanup
          }
          scannerRef.current = null;
        }
      };
    }
  }, [isScannerOpen, scannerType]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>

          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
              Consulta de Productos
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Escanea el código para consultar precios y disponibilidad
            </p>
          </div>
        </div>

        {/* Scanner Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <Card
            className="cursor-pointer transition-all hover:shadow-xl hover:scale-105 border-2 hover:border-blue-500"
            onClick={() => startScanner('barcode')}
          >
            <CardContent className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Camera className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Escanear Código de Barras
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Usa la cámara para escanear códigos de barras
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all hover:shadow-xl hover:scale-105 border-2 hover:border-green-500"
            onClick={() => startScanner('qr')}
          >
            <CardContent className="p-6 text-center">
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <QrCode className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Escanear Código QR
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Usa la cámara para escanear códigos QR
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Product Information */}
        {product && (
          <Card className="border-2 border-green-500 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8" />
                <div>
                  <CardTitle className="text-2xl">{product.name}</CardTitle>
                  <p className="text-sm opacity-90">Código: {product.code}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              {product.description && (
                <div>
                  <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Descripción
                  </h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    {product.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Stock Disponible
                  </p>
                  <p className={`text-2xl font-bold ${
                    product.stock > 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}>
                    {product.stock} unidades
                  </p>
                </div>

                <div className="bg-orange-50 dark:bg-orange-950 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Costo
                  </p>
                  <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {formatCOP(product.current_cost)}
                  </p>
                </div>

                <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Precio 1
                  </p>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCOP(product.price1)}
                  </p>
                </div>

                <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Precio 2 (Al Mayor)
                  </p>
                  <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                    {formatCOP(product.price2)}
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg col-span-2">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Precio Final
                  </p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCOP(product.final_price)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Scanner Dialog */}
      <Dialog open={isScannerOpen} onOpenChange={stopScanner}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>
                {scannerType === 'barcode' ? 'Escanear Código de Barras' : 'Escanear Código QR'}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={stopScanner}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              Centra el código en el recuadro para escanearlo automáticamente
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div
              id="scanner-container"
              className="w-full rounded-lg overflow-hidden"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
