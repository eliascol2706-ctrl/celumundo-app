import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Camera, QrCode, X, Package, Search } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
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
  const [manualCode, setManualCode] = useState('');
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
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-3 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="outline"
            onClick={() => navigate('/')}
            className="mb-4 h-10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>

          <div className="text-center">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              Consulta de Productos
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Escanea o escribe el código para consultar precios y disponibilidad
            </p>
          </div>
        </div>

        {/* Scanner Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card
            className="cursor-pointer transition-all active:scale-95 hover:shadow-lg border-2 hover:border-blue-500"
            onClick={() => startScanner('barcode')}
          >
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Camera className="h-7 w-7 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mb-1">
                Código de Barras
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Escanear con cámara
              </p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer transition-all active:scale-95 hover:shadow-lg border-2 hover:border-green-500"
            onClick={() => startScanner('qr')}
          >
            <CardContent className="p-4 text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <QrCode className="h-7 w-7 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white mb-1">
                Código QR
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                Escanear con cámara
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Búsqueda manual por código */}
        <div className="mb-6">
          <div className="max-w-lg mx-auto">
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-3">
              O escribe el código del producto
            </p>
            <div className="flex gap-2">
              <Input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && manualCode.trim()) {
                    const cleaned = manualCode.trim().replace(/A/g, '');
                    setProduct(null);
                    searchProduct(cleaned);
                    setManualCode('');
                  }
                }}
                placeholder="Ingresa el código..."
                className="bg-white dark:bg-gray-800 text-base h-12"
              />
              <Button
                onClick={() => {
                  if (manualCode.trim()) {
                    const cleaned = manualCode.trim().replace(/A/g, '');
                    setProduct(null);
                    searchProduct(cleaned);
                    setManualCode('');
                  }
                }}
                disabled={isLoading || !manualCode.trim()}
                className="bg-green-600 hover:bg-green-700 text-white shrink-0 h-12 px-5"
              >
                {isLoading
                  ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-r-transparent" />
                  : <Search className="h-5 w-5" />
                }
              </Button>
            </div>
          </div>
        </div>

        {/* Product Information */}
        {product && (
          <Card className="border-2 border-green-500 shadow-xl">
            <CardHeader className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <Package className="h-6 w-6 sm:h-8 sm:w-8 shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-lg sm:text-2xl leading-tight truncate">{product.name}</CardTitle>
                  <p className="text-xs sm:text-sm opacity-90 font-mono mt-0.5">Código: {product.code}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
              {product.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 pb-3">
                  {product.description}
                </p>
              )}

              {/* Stock */}
              <div className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                product.stock > 0
                  ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800'
              }`}>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Disponibilidad</p>
                <div className="text-right">
                  <span className={`text-xl font-bold ${
                    product.stock > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {product.stock > 0 ? `${product.stock} en stock` : 'Sin stock'}
                  </span>
                </div>
              </div>

              {/* Precios */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Precio 1</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    {formatCOP(product.price1)}
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Precio 2</p>
                  <p className="text-lg font-bold text-gray-800 dark:text-gray-100">
                    {formatCOP(product.price2)}
                  </p>
                </div>
              </div>

              {/* Precio Final destacado */}
              <div className="bg-green-600 rounded-xl p-5 text-center text-white shadow-md">
                <p className="text-xs uppercase tracking-widest opacity-80 mb-1">Precio Final</p>
                <p className="text-3xl sm:text-4xl font-bold">
                  {formatCOP(product.final_price)}
                </p>
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
