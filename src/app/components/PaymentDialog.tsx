import { useState } from 'react';
import { DollarSign, CreditCard, Smartphone, Building2, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { addCreditPayment, addCreditHistory, type Invoice, type CreditPayment, getCurrentUser } from '../lib/supabase';
import { toast } from 'sonner';
import { formatCOP } from '../lib/currency';

interface PaymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice;
  onPaymentSuccess: () => void;
}

export function PaymentDialog({ isOpen, onClose, invoice, onPaymentSuccess }: PaymentDialogProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentBalance = invoice.credit_balance || invoice.total;

  const handleSubmit = async () => {
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Ingrese un monto válido');
      return;
    }

    if (paymentAmount > currentBalance) {
      toast.error('El monto no puede ser mayor al saldo pendiente');
      return;
    }

    setIsSubmitting(true);

    const payment: Omit<CreditPayment, 'id' | 'company' | 'created_at'> = {
      invoice_id: invoice.id,
      customer_document: invoice.customer_document || '',
      date: new Date().toISOString(),
      amount: paymentAmount,
      payment_method: paymentMethod,
      notes: notes || undefined,
      registered_by: getCurrentUser()?.username || 'Sistema'
    };

    const result = await addCreditPayment(payment);
    if (result) {
      // Registrar en historial del cliente
      await addCreditHistory({
        customer_document: invoice.customer_document || '',
        event_type: 'payment',
        description: `Pago de ${formatCOP(paymentAmount)} - Factura ${invoice.number}`,
        amount: paymentAmount,
        reference_id: invoice.id,
        registered_by: getCurrentUser()?.username || 'Sistema'
      });

      toast.success('Pago registrado exitosamente');
      setAmount('');
      setNotes('');
      onPaymentSuccess();
      onClose();
    } else {
      toast.error('Error al registrar el pago');
    }

    setIsSubmitting(false);
  };

  const paymentMethods = [
    { value: 'cash', label: 'Efectivo', icon: DollarSign, color: 'text-emerald-600' },
    { value: 'transfer', label: 'Transferencia', icon: Building2, color: 'text-blue-600' },
    { value: 'nequi', label: 'Nequi', icon: Smartphone, color: 'text-purple-600' },
    { value: 'daviplata', label: 'Daviplata', icon: CreditCard, color: 'text-red-600' },
    { value: 'other', label: 'Otro', icon: Wallet, color: 'text-zinc-600' }
  ];

  const setQuickAmount = (percentage: number) => {
    const quickAmount = (currentBalance * percentage) / 100;
    setAmount(quickAmount.toFixed(0));
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Pago</DialogTitle>
          <DialogDescription>
            Factura {invoice.number} • Saldo: {formatCOP(currentBalance)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Monto */}
          <div>
            <Label htmlFor="amount">Monto a Pagar *</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="text-lg font-semibold"
            />
            <div className="flex gap-2 mt-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setQuickAmount(25)}
                className="text-xs"
              >
                25%
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setQuickAmount(50)}
                className="text-xs"
              >
                50%
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setQuickAmount(75)}
                className="text-xs"
              >
                75%
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAmount(currentBalance.toString())}
                className="text-xs"
              >
                Todo
              </Button>
            </div>
          </div>

          {/* Método de Pago */}
          <div>
            <Label>Método de Pago *</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => setPaymentMethod(method.value)}
                    className={`
                      flex items-center gap-2 p-3 rounded-lg border-2 transition-all
                      ${
                        paymentMethod === method.value
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-zinc-200 hover:border-zinc-300'
                      }
                    `}
                  >
                    <Icon className={`w-5 h-5 ${method.color}`} />
                    <span className="text-sm font-medium text-zinc-900">{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas */}
          <div>
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Información adicional del pago..."
              rows={3}
            />
          </div>

          {/* Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-600">Saldo actual:</span>
                <span className="font-medium text-zinc-900">{formatCOP(currentBalance)}</span>
              </div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-zinc-600">Pago a registrar:</span>
                <span className="font-medium text-emerald-600">-{formatCOP(parseFloat(amount))}</span>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-zinc-200">
                <span className="text-zinc-600 font-medium">Saldo restante:</span>
                <span className="font-bold text-zinc-900">
                  {formatCOP(currentBalance - parseFloat(amount))}
                </span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !amount || parseFloat(amount) <= 0}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isSubmitting ? 'Procesando...' : 'Registrar Pago'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
