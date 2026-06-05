import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { ArrowUp, ArrowDown, Printer, Download, X } from 'lucide-react';
import { formatCOP } from '../lib/currency';
import type { MovementReceipt } from '../lib/supabase';

interface MovementReceiptDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: MovementReceipt | null;
  onPrint: () => void;
  onDownload: () => void;
}

export function MovementReceiptDetailsModal({
  open,
  onOpenChange,
  receipt,
  onPrint,
  onDownload
}: MovementReceiptDetailsModalProps) {
  if (!receipt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {receipt.type === 'entry' ? (
                <ArrowUp className="h-5 w-5 text-green-600" />
              ) : (
                <ArrowDown className="h-5 w-5 text-red-600" />
              )}
              Comprobante de {receipt.type === 'entry' ? 'Entrada' : 'Salida'}
            </div>
            <Badge
              variant={receipt.type === 'entry' ? 'default' : 'destructive'}
              className={receipt.type === 'entry' ? 'bg-green-600' : 'bg-red-600'}
            >
              {receipt.reference}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Detalles completos del movimiento de inventario
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Información general */}
          <Card className="p-4 bg-gray-50 dark:bg-zinc-900">
            <h3 className="font-semibold mb-3">Información del Movimiento</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Fecha y Hora:</span>
                <p className="font-semibold">
                  {new Date(receipt.date).toLocaleString('es-ES')}
                </p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Usuario:</span>
                <p className="font-semibold">{receipt.user_name}</p>
              </div>
              <div className="md:col-span-2">
                <span className="text-gray-600 dark:text-gray-400">Motivo:</span>
                <p className="font-semibold">{receipt.reason}</p>
              </div>
            </div>
          </Card>

          {/* Productos */}
          <div>
            <h3 className="font-semibold mb-3">Productos ({receipt.total_products})</h3>
            <div className="space-y-2">
              {receipt.items.map((item, index) => (
                <Card key={index} className="p-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded">
                          {item.productCode}
                        </span>
                        <span className="font-medium">{item.productName}</span>
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <span>Cantidad: <strong className="text-gray-900 dark:text-gray-100">{item.quantity}</strong></span>
                        <span>Costo unitario: <strong className="text-gray-900 dark:text-gray-100">{formatCOP(item.finalCost)}</strong></span>
                        {receipt.type === 'entry' && item.newCost !== undefined && item.newCost !== item.currentCost && (
                          <span className="text-green-600">
                            Nuevo costo: <strong>{formatCOP(item.newCost)}</strong>
                          </span>
                        )}
                      </div>

                      {/* IDs únicas */}
                      {item.unitIds && item.unitIds.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                            IDs de las Unidades:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {item.unitIds.map((id, idx) => (
                              <div key={idx} className="flex flex-col">
                                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 text-xs font-mono rounded border border-blue-300 dark:border-blue-700">
                                  {id}
                                </span>
                                {item.unitIdNotes && item.unitIdNotes[id] && (
                                  <span className="text-[10px] text-gray-600 dark:text-gray-400 px-1">
                                    {item.unitIdNotes[id]}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="text-right sm:text-left">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Total</p>
                      <p className="text-lg font-bold text-green-600">
                        {formatCOP(item.finalCost * item.quantity)}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          {/* Totales */}
          <Card className="p-4 bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Productos</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {receipt.total_products}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Total Unidades {receipt.type === 'entry' ? 'Ingresadas' : 'Descargadas'}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {receipt.total_units}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Costo Total del Inventario</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCOP(receipt.total_cost)}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-2" />
            Cerrar
          </Button>
          <Button variant="outline" onClick={onPrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir PDF
          </Button>
          <Button variant="default" onClick={onDownload} className="bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4 mr-2" />
            Descargar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
