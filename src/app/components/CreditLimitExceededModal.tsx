import { AlertTriangle, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { formatCOP } from '../lib/currency';

interface CreditLimitExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerName: string;
  currentLimit: number;
  invoiceTotal: number;
  currentDebt: number;
  suggestedLimit: number;
  exceedAmount: number;
  onConfirm: () => void;
  isSubmitting?: boolean;
}

export function CreditLimitExceededModal({
  isOpen,
  onClose,
  customerName,
  currentLimit,
  invoiceTotal,
  currentDebt,
  suggestedLimit,
  exceedAmount,
  onConfirm,
  isSubmitting = false
}: CreditLimitExceededModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-amber-100">
            <AlertTriangle className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-lg sm:text-xl">
            Límite de Crédito Excedido
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            Esta venta excede el límite de crédito actual del cliente
          </DialogDescription>
        </DialogHeader>

        <div className="py-3 sm:py-4 space-y-3 sm:space-y-4">
          {/* Información del Cliente */}
          <div className="p-3 sm:p-4 bg-zinc-50 rounded-lg border border-zinc-200">
            <p className="text-xs sm:text-sm font-medium text-zinc-600 mb-1">Cliente</p>
            <p className="text-sm sm:text-base font-semibold text-zinc-900 truncate">{customerName}</p>
          </div>

          {/* Detalles de Crédito */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-blue-900">Límite Actual</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-blue-700 ml-6 sm:ml-0">{formatCOP(currentLimit)}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-zinc-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-zinc-900">Deuda Actual</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-zinc-700 ml-6 sm:ml-0">{formatCOP(currentDebt)}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-purple-900">Monto de Esta Venta</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-purple-700 ml-6 sm:ml-0">{formatCOP(invoiceTotal)}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-red-900">Se Excede Por</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-red-700 ml-6 sm:ml-0">{formatCOP(exceedAmount)}</span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-2 sm:p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-emerald-900">Nuevo Límite Sugerido</span>
              </div>
              <span className="text-base sm:text-lg font-bold text-emerald-700 ml-6 sm:ml-0">{formatCOP(suggestedLimit)}</span>
            </div>
          </div>

          {/* Mensaje de Confirmación */}
          <div className="p-3 sm:p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-xs sm:text-sm text-amber-900">
              <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 inline mr-1" />
              Al confirmar, el límite de crédito del cliente se actualizará automáticamente a <strong>{formatCOP(suggestedLimit)}</strong> para permitir esta venta.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={onConfirm}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-sm sm:text-base"
            disabled={isSubmitting}
            autoFocus
          >
            {isSubmitting ? 'Procesando...' : 'Confirmar y Actualizar Límite'}
          </Button>

          <Button
            onClick={onClose}
            variant="outline"
            className="w-full text-sm sm:text-base"
            disabled={isSubmitting}
          >
            Cancelar Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
