import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ArrowUp, ArrowDown, Printer, Download, Eye, CheckCircle } from 'lucide-react';
import { formatCOP } from '../lib/currency';
import type { MovementReceipt } from '../lib/supabase';

interface MovementCompletionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: MovementReceipt | null;
  onPrint: () => void;
  onDownload: () => void;
  onViewDetails: () => void;
}

export function MovementCompletionModal({
  open,
  onOpenChange,
  receipt,
  onPrint,
  onDownload,
  onViewDetails
}: MovementCompletionModalProps) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle className="h-6 w-6" />
            Movimiento Registrado Exitosamente
          </DialogTitle>
          <DialogDescription>
            El comprobante de movimiento ha sido procesado y almacenado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Badge de tipo */}
          <div className="flex justify-center">
            <Badge
              variant={receipt.type === 'entry' ? 'default' : 'destructive'}
              className={`${receipt.type === 'entry' ? 'bg-green-600' : 'bg-red-600'} text-lg px-4 py-2`}
            >
              <div className="flex items-center gap-2">
                {receipt.type === 'entry' ? (
                  <ArrowUp className="h-5 w-5" />
                ) : (
                  <ArrowDown className="h-5 w-5" />
                )}
                {receipt.type === 'entry' ? 'ENTRADA' : 'SALIDA'}
              </div>
            </Badge>
          </div>

          {/* Detalles del comprobante */}
          <div className="bg-gray-50 dark:bg-zinc-900 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Fecha y Hora</p>
                <p className="font-semibold">
                  {new Date(receipt.date).toLocaleString('es-ES', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>

              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Tipo de Movimiento</p>
                <p className="font-semibold">
                  {receipt.type === 'entry' ? 'Entrada' : 'Salida'}
                </p>
              </div>

              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Referencia</p>
                <p className="font-mono font-semibold text-blue-600">{receipt.reference}</p>
              </div>

              <div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Usuario</p>
                <p className="font-semibold">{receipt.user_name}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-200 dark:border-zinc-700">
              <p className="text-gray-600 dark:text-gray-400 font-medium text-sm mb-1">Motivo</p>
              <p className="font-semibold">{receipt.reason}</p>
            </div>

            {/* Resumen */}
            <div className="pt-3 border-t border-gray-200 dark:border-zinc-700 grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400">Productos</p>
                <p className="text-lg font-bold text-blue-600">{receipt.total_products}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400">Unidades</p>
                <p className="text-lg font-bold text-purple-600">{receipt.total_units}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400">Costo Total</p>
                <p className="text-lg font-bold text-green-600">{formatCOP(receipt.total_cost)}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onViewDetails}
            className="flex-1"
          >
            <Eye className="h-4 w-4 mr-2" />
            Ver Detalles
          </Button>
          <Button
            variant="outline"
            onClick={onPrint}
            className="flex-1"
          >
            <Printer className="h-4 w-4 mr-2" />
            Imprimir PDF
          </Button>
          <Button
            variant="default"
            onClick={onDownload}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
