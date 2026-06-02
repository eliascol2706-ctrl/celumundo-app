import { useState, useEffect } from 'react';
import { Plus, X, User, CreditCard, FileText, Calendar, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { addCustomer, addInvoice, getCustomers, getCurrentUser, type Customer } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';

interface AttachedInvoice {
  date: string;
  amount: number;
  paymentDays: number;
}

type TabMode = 'new' | 'existing';

export function DevPanelCustomersTab() {
  const currentUser = getCurrentUser();
  const [mode, setMode] = useState<TabMode>('new');

  // ── Nuevo cliente ──
  const [name, setName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState(0);
  const [paymentTerm, setPaymentTerm] = useState(30);
  const [notes, setNotes] = useState('');
  const [newInvoices, setNewInvoices] = useState<AttachedInvoice[]>([]);

  // ── Cliente existente ──
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [existingInvoices, setExistingInvoices] = useState<AttachedInvoice[]>([]);

  // ── Modal de factura (compartido) ──
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [invoiceDays, setInvoiceDays] = useState(30);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCustomers().then(setCustomers).catch(() => {});
  }, []);

  const currentInvoices = mode === 'new' ? newInvoices : existingInvoices;
  const setCurrentInvoices = mode === 'new' ? setNewInvoices : setExistingInvoices;

  const handleAddInvoice = () => {
    if (!invoiceDate || invoiceAmount <= 0) {
      toast.error('Completa todos los campos de la factura');
      return;
    }
    setCurrentInvoices(prev => [...prev, { date: invoiceDate, amount: invoiceAmount, paymentDays: invoiceDays }]);
    setInvoiceDate('');
    setInvoiceAmount(0);
    setInvoiceDays(30);
    setShowInvoiceModal(false);
    toast.success('Factura adjuntada');
  };

  const removeInvoice = (idx: number) => {
    setCurrentInvoices(prev => prev.filter((_, i) => i !== idx));
  };

  const buildInvoiceDateISO = (dateStr: string): string => {
    // dateStr viene como "YYYY-MM-DD" desde el input date
    // Construimos un ISO en zona Colombia (UTC-5) usando hora 00:00 local
    if (!dateStr) return new Date().toISOString();
    const [year, month, day] = dateStr.split('-').map(Number);
    // Crear fecha a medianoche Colombia (UTC-5 = +5 horas en UTC)
    const utc = Date.UTC(year, month - 1, day, 5, 0, 0, 0);
    return new Date(utc).toISOString();
  };

  const createInvoicesForCustomer = async (customerName: string, customerDocument: string, invList: AttachedInvoice[]) => {
    for (const inv of invList) {
      const invoiceDateISO = buildInvoiceDateISO(inv.date);
      const dueDate = new Date(inv.date);
      dueDate.setDate(dueDate.getDate() + inv.paymentDays);

      await addInvoice({
        type: 'regular',
        customer_name: customerName,
        customer_document: customerDocument,
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
        date: invoiceDateISO,
      } as any);
    }
  };

  const handleSaveNew = async () => {
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
        total_credit: newInvoices.reduce((s, inv) => s + inv.amount, 0),
        total_paid: 0,
        notes: notes.trim() || undefined,
      });

      if (!customer) { toast.error('Error al crear el cliente'); return; }

      await createInvoicesForCustomer(customer.name, customer.document, newInvoices);

      toast.success(`Cliente "${customer.name}" creado con ${newInvoices.length} factura(s)`);
      setName(''); setDocument(''); setPhone(''); setEmail('');
      setAddress(''); setCreditLimit(0); setPaymentTerm(30); setNotes('');
      setNewInvoices([]);
      // Refrescar lista de clientes
      getCustomers().then(setCustomers).catch(() => {});
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExisting = async () => {
    if (!selectedCustomerId) {
      toast.error('Selecciona un cliente');
      return;
    }
    if (existingInvoices.length === 0) {
      toast.error('Adjunta al menos una factura');
      return;
    }
    const customer = customers.find(c => c.id === selectedCustomerId);
    if (!customer) { toast.error('Cliente no encontrado'); return; }

    setSaving(true);
    try {
      await createInvoicesForCustomer(customer.name, customer.document, existingInvoices);
      toast.success(`${existingInvoices.length} factura(s) adjuntada(s) a "${customer.name}"`);
      setSelectedCustomerId('');
      setExistingInvoices([]);
    } catch (err) {
      console.error(err);
      toast.error('Error al guardar las facturas');
    } finally {
      setSaving(false);
    }
  };

  const InvoiceList = () => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-purple-600" />
          Facturas a Crédito
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentInvoices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>Sin facturas adjuntas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentInvoices.map((inv, idx) => (
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
              <span>{formatCOP(currentInvoices.reduce((s, inv) => s + inv.amount, 0))}</span>
            </div>
          </div>
        )}
        <Button variant="outline" className="w-full" onClick={() => setShowInvoiceModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adjuntar Factura
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4 py-2">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button
          onClick={() => setMode('new')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'new' ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-zinc-100' : 'text-muted-foreground hover:text-zinc-700'
          }`}
        >
          <User className="h-4 w-4" />
          Nuevo Cliente
        </button>
        <button
          onClick={() => setMode('existing')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
            mode === 'existing' ? 'bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-zinc-100' : 'text-muted-foreground hover:text-zinc-700'
          }`}
        >
          <Users className="h-4 w-4" />
          Cliente Existente
        </button>
      </div>

      {/* ── Modo: Nuevo Cliente ── */}
      {mode === 'new' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                    <Input type="number" min="0" value={creditLimit} onChange={e => setCreditLimit(parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Plazo de pago (días)</Label>
                    <Input type="number" min="1" value={paymentTerm} onChange={e => setPaymentTerm(parseInt(e.target.value) || 30)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Notas</Label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones opcionales" />
                </div>
              </CardContent>
            </Card>
            <InvoiceList />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveNew} disabled={saving} className="px-8">
              {saving ? 'Guardando...' : 'Crear Cliente'}
            </Button>
          </div>
        </>
      )}

      {/* ── Modo: Cliente Existente ── */}
      {mode === 'existing' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  Seleccionar Cliente
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs">Cliente registrado *</Label>
                  <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Buscar cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.length === 0 ? (
                        <SelectItem value="__none__" disabled>No hay clientes registrados</SelectItem>
                      ) : (
                        customers.map(c => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} — {c.document}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCustomerId && (() => {
                  const c = customers.find(cu => cu.id === selectedCustomerId);
                  if (!c) return null;
                  return (
                    <div className="p-3 bg-muted rounded-lg space-y-1 text-sm">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</div>
                      <div className="text-muted-foreground">Doc: {c.document}</div>
                      {c.phone && <div className="text-muted-foreground">Tel: {c.phone}</div>}
                      <div className="text-muted-foreground">Cupo: {formatCOP(c.credit_limit)}</div>
                      <div className={`font-medium ${c.status === 'active' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        Estado: {c.status === 'active' ? 'Activo' : c.status === 'overdue' ? 'Vencido' : 'Bloqueado'}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
            <InvoiceList />
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSaveExisting} disabled={saving} className="px-8">
              {saving ? 'Guardando...' : 'Adjuntar Facturas'}
            </Button>
          </div>
        </>
      )}

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
              <Input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
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
              <Button variant="outline" className="flex-1" onClick={() => setShowInvoiceModal(false)}>Cancelar</Button>
              <Button className="flex-1" onClick={handleAddInvoice}>Agregar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
