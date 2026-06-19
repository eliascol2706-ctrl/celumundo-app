import { useState, useEffect } from 'react';
import { FileText, Plus, DollarSign, Calendar, AlertCircle, CheckCircle, XCircle, Clock, History, Search, Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';
import { supabase, getCurrentCompany, getCurrentUser, getColombiaDate, extractColombiaDate, getSuppliers, type Supplier } from '../lib/supabase';

interface SupplierDebt {
  id: string;
  company: string;
  invoice_reference: string;
  supplier_name: string;
  supplier_address?: string;
  supplier_id?: string;
  products_description?: string;
  payment_term_days: number;
  total_amount: number;
  paid_amount: number;
  pending_amount: number;
  status: 'active' | 'paid' | 'overdue' | 'cancelled';
  invoice_date: string;
  due_date: string;
  paid_date?: string;
  cancelled_date?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  notes?: string;
}

interface DebtPayment {
  id: string;
  company: string;
  debt_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  created_at: string;
  created_by?: string;
  notes?: string;
}

export default function SupplierDebts() {
  const [debts, setDebts] = useState<SupplierDebt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Modal editar proveedor de deuda
  const [showEditSupplierModal, setShowEditSupplierModal] = useState(false);
  const [editSupplierDebt, setEditSupplierDebt] = useState<SupplierDebt | null>(null);
  const [editSupplierId, setEditSupplierId] = useState('');

  // Helper para formatear fecha de Colombia
  const formatColombiaDate = (dateStr: string) => {
    const colombiaDate = extractColombiaDate(dateStr);
    const [year, month, day] = colombiaDate.split('-');
    return `${day}/${month}/${year}`;
  };

  // Modal de nueva deuda
  const [showNewDebtModal, setShowNewDebtModal] = useState(false);
  const [newDebt, setNewDebt] = useState({
    invoice_reference: '',
    supplier_name: '',
    supplier_address: '',
    supplier_id: '',
    products_description: '',
    payment_term_days: 30,
    total_amount: 0,
    invoice_date: getColombiaDate(),
    notes: ''
  });

  // Modal de abono
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<SupplierDebt | null>(null);
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    payment_method: 'efectivo',
    payment_date: getColombiaDate(),
    notes: ''
  });

  // Modal de historial
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyDebt, setHistoryDebt] = useState<SupplierDebt | null>(null);
  const [debtPayments, setDebtPayments] = useState<DebtPayment[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const company = getCurrentCompany();

      const [{ data: debtsData }, { data: paymentsData }, suppliersData] = await Promise.all([
        supabase.from('supplier_debts').select('*').eq('company', company).order('created_at', { ascending: false }),
        supabase.from('supplier_debt_payments').select('*').eq('company', company).order('created_at', { ascending: false }),
        getSuppliers(),
      ]);

      setDebts(debtsData || []);
      setPayments(paymentsData || []);
      setSuppliers(suppliersData);
    } catch (error) {
      console.error('Error loading debts:', error);
      toast.error('Error al cargar las deudas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDebt = async () => {
    if (!newDebt.invoice_reference.trim() || !newDebt.supplier_name.trim()) {
      toast.error('Completa los campos obligatorios');
      return;
    }

    if (newDebt.total_amount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    try {
      const company = getCurrentCompany();
      const user = getCurrentUser();

      // Calcular fecha de vencimiento
      const invoiceDate = new Date(newDebt.invoice_date);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + newDebt.payment_term_days);

      const { error } = await supabase.from('supplier_debts').insert([{
        company,
        invoice_reference: newDebt.invoice_reference,
        supplier_name: newDebt.supplier_name,
        supplier_address: newDebt.supplier_address || null,
        supplier_id: newDebt.supplier_id || null,
        products_description: newDebt.products_description || null,
        payment_term_days: newDebt.payment_term_days,
        total_amount: newDebt.total_amount,
        paid_amount: 0,
        pending_amount: newDebt.total_amount,
        status: 'active',
        invoice_date: newDebt.invoice_date,
        due_date: dueDate.toISOString().split('T')[0],
        created_by: user?.username,
        notes: newDebt.notes || null
      }]);

      if (error) throw error;

      toast.success('Deuda registrada exitosamente');
      setShowNewDebtModal(false);
      setNewDebt({
        invoice_reference: '',
        supplier_name: '',
        supplier_address: '',
        supplier_id: '',
        products_description: '',
        payment_term_days: 30,
        total_amount: 0,
        invoice_date: getColombiaDate(),
        notes: ''
      });
      loadData();
    } catch (error) {
      console.error('Error creating debt:', error);
      toast.error('Error al registrar la deuda');
    }
  };

  const handleSaveDebtSupplier = async () => {
    if (!editSupplierDebt) return;
    try {
      const { error } = await supabase.from('supplier_debts')
        .update({ supplier_id: editSupplierId || null })
        .eq('id', editSupplierDebt.id);
      if (error) throw error;
      toast.success('Proveedor asignado correctamente');
      setShowEditSupplierModal(false);
      setEditSupplierDebt(null);
      loadData();
    } catch (error) {
      console.error('Error updating supplier:', error);
      toast.error('Error al asignar el proveedor');
    }
  };

  const handleAddPayment = async () => {
    if (!selectedDebt) return;

    if (paymentData.amount <= 0) {
      toast.error('El monto debe ser mayor a 0');
      return;
    }

    if (paymentData.amount > selectedDebt.pending_amount) {
      toast.error('El monto no puede ser mayor al pendiente');
      return;
    }

    try {
      const company = getCurrentCompany();
      const user = getCurrentUser();

      // Registrar el pago
      const { error: paymentError } = await supabase.from('supplier_debt_payments').insert([{
        company,
        debt_id: selectedDebt.id,
        amount: paymentData.amount,
        payment_method: paymentData.payment_method,
        payment_date: paymentData.payment_date,
        created_by: user?.username,
        notes: paymentData.notes || null
      }]);

      if (paymentError) throw paymentError;

      // Actualizar la deuda
      const newPaidAmount = selectedDebt.paid_amount + paymentData.amount;
      const { error: updateError } = await supabase.from('supplier_debts')
        .update({ paid_amount: newPaidAmount })
        .eq('id', selectedDebt.id);

      if (updateError) throw updateError;

      toast.success('Abono registrado exitosamente');
      setShowPaymentModal(false);
      setSelectedDebt(null);
      setPaymentData({
        amount: 0,
        payment_method: 'efectivo',
        payment_date: getColombiaDate(),
        notes: ''
      });
      loadData();
    } catch (error) {
      console.error('Error adding payment:', error);
      toast.error('Error al registrar el abono');
    }
  };

  const handleCancelDebt = async (debt: SupplierDebt) => {
    if (!confirm(`¿Estás seguro de anular la factura "${debt.invoice_reference}"?`)) return;

    try {
      // Usar fecha de Colombia en formato ISO
      const colombiaDateStr = getColombiaDate(); // YYYY-MM-DD
      const cancelledDate = new Date(colombiaDateStr + 'T00:00:00-05:00').toISOString();

      const { error } = await supabase.from('supplier_debts')
        .update({
          status: 'cancelled',
          cancelled_date: cancelledDate
        })
        .eq('id', debt.id);

      if (error) throw error;

      toast.success('Deuda anulada exitosamente');
      loadData();
    } catch (error) {
      console.error('Error cancelling debt:', error);
      toast.error('Error al anular la deuda');
    }
  };

  const handleShowHistory = async (debt: SupplierDebt) => {
    setHistoryDebt(debt);
    const debtPaymentsList = payments.filter(p => p.debt_id === debt.id);
    setDebtPayments(debtPaymentsList);
    setShowHistoryModal(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400">Activa</Badge>;
      case 'paid':
        return <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">Pagada</Badge>;
      case 'overdue':
        return <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Atrasada</Badge>;
      case 'cancelled':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400">Anulada</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const filteredDebts = debts.filter(debt =>
    debt.invoice_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
    debt.supplier_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calcular estadísticas
  const activeDebts = debts.filter(d => d.status === 'active' || d.status === 'overdue');
  const totalPending = activeDebts.reduce((sum, d) => sum + d.pending_amount, 0);
  const totalOverdue = debts.filter(d => d.status === 'overdue').reduce((sum, d) => sum + d.pending_amount, 0);
  const totalPaid = debts.reduce((sum, d) => sum + d.paid_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="h-12 w-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-lg font-medium text-gray-700 dark:text-gray-300">Cargando deudas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Gestión de Deudas</h2>
          <p className="text-muted-foreground mt-1">Administra las facturas de proveedores</p>
        </div>
        <Button onClick={() => setShowNewDebtModal(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-4 w-4 mr-2" />
          Nueva Deuda
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-red-200 dark:border-red-800 bg-red-50/30 dark:bg-red-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Total Pendiente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-400">{formatCOP(totalPending)}</div>
            <p className="text-xs text-red-600 dark:text-red-500 mt-1">{activeDebts.length} deudas activas</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-700 dark:text-orange-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Atrasadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700 dark:text-orange-400">{formatCOP(totalOverdue)}</div>
            <p className="text-xs text-orange-600 dark:text-orange-500 mt-1">Vencidas</p>
          </CardContent>
        </Card>

        <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-700 dark:text-green-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Total Pagado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCOP(totalPaid)}</div>
            <p className="text-xs text-green-600 dark:text-green-500 mt-1">Abonos realizados</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Total Facturas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{debts.length}</div>
            <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Registradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Buscador */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Buscar por referencia o proveedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabla de deudas */}
      <Card>
        <CardHeader>
          <CardTitle>Facturas de Proveedores</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-3 text-sm font-semibold">Fecha</th>
                  <th className="text-left p-3 text-sm font-semibold">Referencia</th>
                  <th className="text-left p-3 text-sm font-semibold">Proveedor</th>
                  <th className="text-right p-3 text-sm font-semibold">Monto Total</th>
                  <th className="text-right p-3 text-sm font-semibold">Monto Pagado</th>
                  <th className="text-right p-3 text-sm font-semibold">Monto Pendiente</th>
                  <th className="text-center p-3 text-sm font-semibold">Estado</th>
                  <th className="text-center p-3 text-sm font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredDebts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-muted-foreground">No hay deudas registradas</p>
                    </td>
                  </tr>
                ) : (
                  filteredDebts.map((debt) => (
                    <tr key={debt.id} className="border-b hover:bg-muted/50">
                      <td className="p-3 text-sm">{formatColombiaDate(debt.invoice_date)}</td>
                      <td className="p-3 text-sm font-medium">{debt.invoice_reference}</td>
                      <td className="p-3 text-sm">{debt.supplier_name}</td>
                      <td className="p-3 text-sm text-right font-semibold">{formatCOP(debt.total_amount)}</td>
                      <td className="p-3 text-sm text-right text-green-600">{formatCOP(debt.paid_amount)}</td>
                      <td className="p-3 text-sm text-right text-red-600 font-semibold">{formatCOP(debt.pending_amount)}</td>
                      <td className="p-3 text-center">{getStatusBadge(debt.status)}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShowHistory(debt)}
                            title="Ver historial"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditSupplierDebt(debt);
                              setEditSupplierId(debt.supplier_id || '');
                              setShowEditSupplierModal(true);
                            }}
                            title="Asignar proveedor"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                          >
                            <Building2 className="h-4 w-4" />
                          </Button>
                          {debt.status !== 'cancelled' && debt.status !== 'paid' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedDebt(debt);
                                  setPaymentData({
                                    amount: debt.pending_amount,
                                    payment_method: 'efectivo',
                                    payment_date: getColombiaDate(),
                                    notes: ''
                                  });
                                  setShowPaymentModal(true);
                                }}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                                title="Abonar"
                              >
                                <DollarSign className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCancelDebt(debt)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                                title="Anular"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Nueva Deuda */}
      <Dialog open={showNewDebtModal} onOpenChange={setShowNewDebtModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Registrar Nueva Deuda
            </DialogTitle>
            <DialogDescription>
              Registra una factura de proveedor pendiente de pago
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Selector de proveedor registrado */}
            {suppliers.length > 0 && (
              <div className="space-y-2">
                <Label>Proveedor Registrado</Label>
                <Select
                  value={newDebt.supplier_id || 'none'}
                  onValueChange={(val) => {
                    const sup = val === 'none' ? null : suppliers.find(s => s.id === val);
                    setNewDebt(prev => ({
                      ...prev,
                      supplier_id: val === 'none' ? '' : val,
                      supplier_name: sup ? sup.name : prev.supplier_name,
                      supplier_address: sup?.address || prev.supplier_address,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Sin proveedor registrado —</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Al seleccionar un proveedor se autocompleta el nombre y dirección.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoice_reference">Referencia de Factura *</Label>
                <Input
                  id="invoice_reference"
                  value={newDebt.invoice_reference}
                  onChange={(e) => setNewDebt({ ...newDebt, invoice_reference: e.target.value })}
                  placeholder="Ej: FAC-2024-001"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supplier_name">Nombre del Proveedor *</Label>
                <Input
                  id="supplier_name"
                  value={newDebt.supplier_name}
                  onChange={(e) => setNewDebt({ ...newDebt, supplier_name: e.target.value })}
                  placeholder="Ej: Distribuidora XYZ"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier_address">Dirección</Label>
              <Input
                id="supplier_address"
                value={newDebt.supplier_address}
                onChange={(e) => setNewDebt({ ...newDebt, supplier_address: e.target.value })}
                placeholder="Dirección del proveedor"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="products_description">Descripción de Productos</Label>
              <Input
                id="products_description"
                value={newDebt.products_description}
                onChange={(e) => setNewDebt({ ...newDebt, products_description: e.target.value })}
                placeholder="Breve descripción de los productos"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="total_amount">Monto Total *</Label>
                <Input
                  id="total_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newDebt.total_amount || ''}
                  onChange={(e) => setNewDebt({ ...newDebt, total_amount: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_term_days">Plazo (Días)</Label>
                <Input
                  id="payment_term_days"
                  type="number"
                  min="1"
                  value={newDebt.payment_term_days}
                  onChange={(e) => setNewDebt({ ...newDebt, payment_term_days: parseInt(e.target.value) || 30 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoice_date">Fecha Factura *</Label>
                <Input
                  id="invoice_date"
                  type="date"
                  value={newDebt.invoice_date}
                  onChange={(e) => setNewDebt({ ...newDebt, invoice_date: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Input
                id="notes"
                value={newDebt.notes}
                onChange={(e) => setNewDebt({ ...newDebt, notes: e.target.value })}
                placeholder="Notas o comentarios adicionales"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDebtModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDebt} className="bg-blue-600 hover:bg-blue-700">
              Registrar Deuda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Abonar */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Registrar Abono
            </DialogTitle>
            <DialogDescription>
              Factura: {selectedDebt?.invoice_reference}
            </DialogDescription>
          </DialogHeader>

          {selectedDebt && (
            <div className="space-y-4 py-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monto Total:</span>
                  <span className="font-semibold">{formatCOP(selectedDebt.total_amount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monto Pagado:</span>
                  <span className="font-semibold text-green-600">{formatCOP(selectedDebt.paid_amount)}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground font-semibold">Monto Pendiente:</span>
                  <span className="font-bold text-red-600">{formatCOP(selectedDebt.pending_amount)}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_amount">Monto del Abono *</Label>
                <Input
                  id="payment_amount"
                  type="number"
                  min="0"
                  max={selectedDebt.pending_amount}
                  step="0.01"
                  value={paymentData.amount || ''}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Método de Pago</Label>
                <select
                  id="payment_method"
                  value={paymentData.payment_method}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_method: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                  <option value="cheque">Cheque</option>
                  <option value="otros">Otros</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_date">Fecha del Abono</Label>
                <Input
                  id="payment_date"
                  type="date"
                  value={paymentData.payment_date}
                  onChange={(e) => setPaymentData({ ...paymentData, payment_date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_notes">Notas</Label>
                <Input
                  id="payment_notes"
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                  placeholder="Notas del abono"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddPayment} className="bg-green-600 hover:bg-green-700">
              Registrar Abono
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Historial */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Historial de Deuda
            </DialogTitle>
            <DialogDescription>
              Factura: {historyDebt?.invoice_reference} - {historyDebt?.supplier_name}
            </DialogDescription>
          </DialogHeader>

          {historyDebt && (
            <div className="space-y-6 py-4">
              {/* Información de la deuda */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Información de la Factura</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Proveedor:</p>
                      <p className="font-semibold">{historyDebt.supplier_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Referencia:</p>
                      <p className="font-semibold">{historyDebt.invoice_reference}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fecha Factura:</p>
                      <p className="font-semibold">{formatColombiaDate(historyDebt.invoice_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fecha Vencimiento:</p>
                      <p className="font-semibold">{formatColombiaDate(historyDebt.due_date)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Monto Total:</p>
                      <p className="font-semibold text-lg">{formatCOP(historyDebt.total_amount)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Estado:</p>
                      <div className="mt-1">{getStatusBadge(historyDebt.status)}</div>
                    </div>
                  </div>
                  {historyDebt.products_description && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground text-sm">Productos:</p>
                      <p className="text-sm">{historyDebt.products_description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historial de abonos */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Historial de Abonos ({debtPayments.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {debtPayments.length === 0 ? (
                    <div className="text-center py-8">
                      <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-muted-foreground text-sm">No hay abonos registrados</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {debtPayments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium">
                                {formatColombiaDate(payment.payment_date)}
                              </span>
                              <Badge variant="outline" className="text-xs">{payment.payment_method}</Badge>
                            </div>
                            {payment.notes && (
                              <p className="text-xs text-muted-foreground mt-1">{payment.notes}</p>
                            )}
                            {payment.created_by && (
                              <p className="text-xs text-muted-foreground mt-1">Por: {payment.created_by}</p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600">{formatCOP(payment.amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Resumen */}
              <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-950/20">
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Monto Total:</span>
                      <span className="font-semibold">{formatCOP(historyDebt.total_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Pagado:</span>
                      <span className="font-semibold text-green-600">{formatCOP(historyDebt.paid_amount)}</span>
                    </div>
                    <div className="flex justify-between text-base border-t pt-2">
                      <span className="font-semibold">Saldo Pendiente:</span>
                      <span className="font-bold text-red-600 text-lg">{formatCOP(historyDebt.pending_amount)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Asignar proveedor a deuda */}
      <Dialog open={showEditSupplierModal} onOpenChange={setShowEditSupplierModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Asignar Proveedor
            </DialogTitle>
            <DialogDescription>
              Factura: <span className="font-semibold">{editSupplierDebt?.invoice_reference}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="py-3">
            <Select value={editSupplierId || 'none'} onValueChange={v => setEditSupplierId(v === 'none' ? '' : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sin proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sin proveedor —</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditSupplierModal(false)}>Cancelar</Button>
            <Button onClick={handleSaveDebtSupplier}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
