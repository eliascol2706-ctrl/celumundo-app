import { AlertTriangle, DollarSign, Calendar, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { formatCOP } from '../lib/currency';
import type { Customer } from '../lib/supabase';

interface CreditWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  totalDebt: number;
  overdueDays: number;
  onRegisterPayment: () => void;
  onContinueAnyway: () => void;
  userRole: 'admin' | 'seller';
}

export function CreditWarningModal({
  isOpen,
  onClose,
  customer,
  totalDebt,
  overdueDays,
  onRegisterPayment,
  onContinueAnyway,
  userRole
}: CreditWarningModalProps) {
  const isBlocked = customer.blocked;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100">
            <AlertTriangle className="w-8 h-8 text-amber-600" />
          </div>
          <DialogTitle className="text-center text-xl">
            {isBlocked ? '¡Cliente Bloqueado!' : '¡Advertencia de Crédito!'}
          </DialogTitle>
          <DialogDescription className="text-center">
            {isBlocked
              ? 'Este cliente está bloqueado y no puede realizar compras a crédito'
              : 'Este cliente tiene facturas vencidas'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {/* Información del Cliente */}
          <div className="p-4 bg-zinc-50 rounded-lg border border-zinc-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-zinc-600">Cliente</span>
              {isBlocked ? (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                  <XCircle className="w-3 h-3 mr-1" />
                  Bloqueado
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Vencido
                </Badge>
              )}
            </div>
            <p className="font-semibold text-zinc-900">{customer.name}</p>
            <p className="text-sm text-zinc-500">{customer.document}</p>
          </div>

          {/* Detalles de Deuda */}
          {!isBlocked && (
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-red-900">Deuda Total</span>
                </div>
                <span className="text-lg font-bold text-red-700">{formatCOP(totalDebt)}</span>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">Días de Mora</span>
                </div>
                <span className="text-lg font-bold text-amber-700">{overdueDays} días</span>
              </div>
            </div>
          )}

          {/* Mensaje */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-900">
              {isBlocked
                ? '⚠️ Contacte al administrador para desbloquear este cliente.'
                : '💡 Se recomienda registrar un pago antes de continuar con nuevas ventas.'}
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          {!isBlocked && (
            <Button onClick={onRegisterPayment} className="w-full bg-emerald-600 hover:bg-emerald-700" autoFocus>
              <DollarSign className="w-4 h-4 mr-2" />
              Registrar Pago
            </Button>
          )}

          {!isBlocked && userRole === 'admin' && (
            <Button onClick={onContinueAnyway} variant="outline" className="w-full border-amber-300 text-amber-700 hover:bg-amber-50">
              Continuar de Todos Modos
            </Button>
          )}

          <Button onClick={onClose} variant="outline" className="w-full">
            Cancelar Venta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
