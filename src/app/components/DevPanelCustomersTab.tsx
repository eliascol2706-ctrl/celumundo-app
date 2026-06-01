import { useState } from 'react';
import { Plus, X, User, CreditCard, FileText, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { addCustomer, addInvoice, getCurrentUser } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';

interface AttachedInvoice {
  date: string;
  amount: number;
  paymentDays: number;
}

export function DevPanelCustomersTab() {
  const currentUser = getCurrentUser();

  // Datos del cliente
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);
  const [paymentTerm, setPaymentTerm] = useState(30);
  const [notes, setNotes] = useState('');

  // Facturas adjuntas
  const [invoices, setInvoices] = useState<AttachedInvoice[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // Formulario de factura
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [invoiceDays, setInvoiceDays] = useState(30);

  const [saving, setSaving] = useState(false);

  const handleAddInvoice = () => {
    if (!invoiceDate || invoiceAmount <= 0) {
      toast.error('Completa todos los campos de la factura');
      return;
    }
    setInvoices(prev => [...prev, { date: invoiceDate, amount: invoiceAmount, paymentDays: invoiceDays }]);
    setInvoiceDate('');
    setInvoiceAmount(0);
    setInvoiceDays(30);
    setShowInvoiceModal(false);
    toast.success('Factura adjuntada');
  };

  const removeInvoice = (idx: number) => {
    setInvoices(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!name.trim() || !document.trim()) {
      toast.error('Nombre y documento son obligatorios');
      return;
    }

    setSaving(true);
    try {
      const customer = await addCustomer({
        name: name.trim(),
        document: document.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address: address.trim() || undefined,
        credit_limit: creditLimit,
        payment_term: paymentTerm,
        status: 'active',
        blocked: false,
        total_credit: invoices.reduce((s, inv) => s + inv.amount, 0),
        total_paid: 0,
        notes: notes.trim() || undefined,
      });

      if (!customer) {
        toast.error('Error al crear el cliente');
        return;
      }

      // Crear facturas a crédito adjuntas
      for (const inv of invoices) {
        const dueDate = new Date(inv.date);
        dueDate.setDate(dueDate.getDate() + inv.paymentDays);

        await addInvoice({
          type: 'regular',
          customer_name: customer.name,
          customer_document: customer.document,
          items: [],
          subtotal: inv.amount,
          tax: 0,
          total: inv.amount,
          status: 'pending',
          is_credit: true,
          credit_balance: inv.amount,
          due_date: dueDate.toISOString(),
          payment_method: 'credito',
          attended_by: currentUser?.username || 'Sistema',
        });
      }

      toast.success(`Cliente "${customer.name}" creado con ${invoices.length} factura(s)`);

      // Reset
      setName(''); setDocument(''); setPhone(''); setEmail('');
      setAddress(''); setCreditLimit(0); setPaymentTerm(30); setNotes('');
      setInvoices([]);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 py-2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Datos del Cliente */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-purple-600" />
              Datos del Cliente
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nombre completo *</Label>
                <Input value={name} onChange={e => setName(e.target.value)} placeholder="Juan Pérez" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Documento *</Label>
                <Input value={document} onChange={e => setDocument(e.target.value)} placeholder="CC / NIT" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Teléfono</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="300 000 0000" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Correo</Label>
                <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" type="email" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Dirección</Label>
              <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Dirección" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Cupo de crédito (COP)</Label>
                <Input
                  type="number"
                  min="0"
                  value={creditLimit}
                  onChange={e => setCreditLimit(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Plazo de pago (días)</Label>
                <Input
                  type="number"
                  min="1"
                  value={paymentTerm}
                  onChange={e => setPaymentTerm(parseInt(e.target.value) || 30)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Notas</Label>
              <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones opcionales" />
            </div>
          </CardContent>
        </Card>

        {/* Facturas adjuntas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-purple-600" />
              Facturas a Crédito
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {invoices.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>Sin facturas adjuntas</p>
              </div>
            ) : (
              <div className="space-y-2">
                {invoices.map((inv, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3 w-3 text-muted-foreground" />
                      <span>{inv.date}</span>
                    </div>
                    <span className="font-medium">{formatCOP(inv.amount)}</span>
                    <span className="text-muted-foreground">{inv.paymentDays} días</span>
                    <button onClick={() => removeInvoice(idx)} className="text-red-500 hover:text-red-700">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <div className="pt-1 border-t flex justify-between text-sm font-semibold">
                  <span>Total crédito:</span>
                  <span>{formatCOP(invoices.reduce((s, inv) => s + inv.amount, 0))}</span>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowInvoiceModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adjuntar Factura
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="px-8">
          {saving ? 'Guardando...' : 'Crear Cliente'}
        </Button>
      </div>

      {/* Modal de factura */}
      <Dialog open={showInvoiceModal} onOpenChange={setShowInvoiceModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Adjuntar Factura
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label>Fecha de la factura</Label>
              <Input
                type="date"
                value={invoiceDate}
                onChange={e => setInvoiceDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Monto de la factura (COP)</Label>
              <Input
                type="number"
                min="0"
                value={invoiceAmount || ''}
                onChange={e => setInvoiceAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
              />
            </div>
            <div className="space-y-1">
              <Label>Días de pago</Label>
              <Input
                type="number"
                min="1"
                value={invoiceDays}
                onChange={e => setInvoiceDays(parseInt(e.target.value) || 30)}
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowInvoiceModal(false)}>
                Cancelar
              </Button>
              <Button className="flex-1" onClick={handleAddInvoice}>
                Agregar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
