import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  DollarSign,
  Calendar,
  FileText,
  Clock,
  Ban,
  CheckCircle,
  AlertCircle,
  Receipt,
  History,
  Lock,
  Unlock,
  Link,
  Copy,
  ImageIcon,
  X,
  TrendingDown,
  TrendingUp,
  FileX,
  Minus,
  Loader2
} from 'lucide-react';
import {
  getCustomerByDocument,
  getInvoices,
  getAllInvoices,
  getInvoicesByCustomer,
  getCreditHistory,
  getCreditPaymentsByInvoice,
  updateCustomer,
  addCreditHistory,
  getCreditNotesByCustomer,
  getDebitNotesByCustomer,
  addCreditNote,
  addHistoryMovement,
  getAllProducts,
  supabase,
  type Customer,
  type Invoice,
  type CreditHistory as CreditHistoryType,
  type CreditPayment,
  type CreditNoteItem,
  type HistoryMovementProduct,
  getCurrentUser,
  getCurrentCompany
} from '../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { formatCOP } from '../lib/currency';
import { toast } from 'sonner';
import { PaymentDialog } from '../components/PaymentDialog';
import { AgingReportView } from '../components/AgingReportView';

export function CustomerProfile() {
  const { document } = useParams<{ document: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [history, setHistory] = useState<CreditHistoryType[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showTrackingLinkDialog, setShowTrackingLinkDialog] = useState(false);
  const [saldoAFavor, setSaldoAFavor] = useState(0);
  const [debitNotesTotal, setDebitNotesTotal] = useState(0);
  const [debitNotes, setDebitNotes] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);

  // Credit note modal state
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [creditNoteInvoice, setCreditNoteInvoice] = useState<Invoice | null>(null);
  const [creditNoteReason, setCreditNoteReason] = useState('');
  const [creditNoteRefundMethod, setCreditNoteRefundMethod] = useState('');
  const [creditNoteAmount, setCreditNoteAmount] = useState<number>(0);
  const [creditNoteNotes, setCreditNoteNotes] = useState('');
  const [issuingCreditNote, setIssuingCreditNote] = useState(false);
  const [pendingCustomerInvoices, setPendingCustomerInvoices] = useState<Invoice[]>([]);
  const [targetInvoiceId, setTargetInvoiceId] = useState<string>('');

  // General credit/debit note modal state (no invoice)
  const [showGeneralCreditNoteModal, setShowGeneralCreditNoteModal] = useState(false);
  const [showGeneralDebitNoteModal, setShowGeneralDebitNoteModal] = useState(false);
  const [generalNoteReason, setGeneralNoteReason] = useState('');
  const [generalNoteRefundMethod, setGeneralNoteRefundMethod] = useState('');
  const [generalNoteAmount, setGeneralNoteAmount] = useState<number>(0);
  const [generalNoteNotes, setGeneralNoteNotes] = useState('');
  const [generalNoteDueDate, setGeneralNoteDueDate] = useState('');
  const [issuingGeneralNote, setIssuingGeneralNote] = useState(false);
  const [generalTargetInvoiceId, setGeneralTargetInvoiceId] = useState<string>('');

  // Invoice selection modal for credit notes
  const [showInvoiceSelectionModal, setShowInvoiceSelectionModal] = useState(false);
  const [selectedInvoicesForCredit, setSelectedInvoicesForCredit] = useState<string[]>([]);
  const [distributionPreview, setDistributionPreview] = useState<{
    invoiceId: string;
    invoiceNumber: string;
    amountToApply: number;
    remainingBalance: number;
  }[]>([]);

  // Debit note payment modal
  const [showDebitNotePaymentModal, setShowDebitNotePaymentModal] = useState(false);
  const [selectedDebitNote, setSelectedDebitNote] = useState<any | null>(null);
  const [debitNotePaymentAmount, setDebitNotePaymentAmount] = useState<number>(0);
  const [debitNotePaymentMethod, setDebitNotePaymentMethod] = useState('');
  const [debitNotePaymentNotes, setDebitNotePaymentNotes] = useState('');
  const [processingDebitPayment, setProcessingDebitPayment] = useState(false);

  useEffect(() => {
    if (document) {
      loadCustomerData();
    }
  }, [document]);

  const loadCustomerData = async () => {
    if (!document) return;

    setLoading(true);
    try {
      // Decodificar el documento de la URL por si tiene caracteres especiales
      const decodedDocument = decodeURIComponent(document);

      const customerData = await getCustomerByDocument(decodedDocument);

      if (!customerData) {
        console.error('Cliente no encontrado con documento:', decodedDocument);
        toast.error('Cliente no encontrado');
        navigate('/sistema/clientes');
        return;
      }

      const [customerInvoices, historyData, creditNotes, debitNotesData, allProducts] = await Promise.all([
        getInvoicesByCustomer(decodedDocument, customerData.name),
        getCreditHistory(decodedDocument),
        getCreditNotesByCustomer(decodedDocument),
        getDebitNotesByCustomer(decodedDocument),
        getAllProducts()
      ]);
      setProducts(allProducts);
      setSaldoAFavor(creditNotes.reduce((s, cn) => s + cn.balance_remaining, 0));
      setDebitNotes(debitNotesData);
      setDebitNotesTotal(debitNotesData.reduce((s, dn) => s + (dn.balance_remaining ?? dn.amount), 0));

      // Calcular el estado correcto del cliente basándose en sus facturas
      let calculatedStatus: 'active' | 'overdue' | 'blocked' = 'active';

      if (customerData.blocked) {
        calculatedStatus = 'blocked';
      } else {
        // Verificar si tiene facturas pendientes vencidas
        const today = new Date();
        const hasOverdueInvoices = customerInvoices.some((inv) => {
          if (inv.status !== 'pending' || !inv.due_date) return false;
          const dueDate = new Date(inv.due_date);
          return dueDate < today;
        });

        calculatedStatus = hasOverdueInvoices ? 'overdue' : 'active';
      }

      // Si el estado calculado es diferente al guardado, actualizar en la base de datos
      if (calculatedStatus !== customerData.status) {
        await updateCustomer(customerData.id, { status: calculatedStatus });
        customerData.status = calculatedStatus;
      }

      setCustomer(customerData);
      setInvoices(customerInvoices);
      setHistory(historyData);
    } catch (error) {
      console.error('Error loading customer data:', error);
      toast.error('Error al cargar los datos del cliente');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!customer) return;

    const newBlockedStatus = !customer.blocked;
    const confirmMessage = newBlockedStatus
      ? '¿Está seguro de bloquear este cliente? No podrá realizar nuevas ventas a crédito.'
      : '¿Está seguro de desbloquear este cliente?';

    if (!confirm(confirmMessage)) return;

    setIsUpdating(true);

    // Calcular el nuevo estado
    let newStatus: 'active' | 'overdue' | 'blocked';
    if (newBlockedStatus) {
      newStatus = 'blocked';
    } else {
      // Si se desbloquea, verificar si tiene facturas vencidas
      const today = new Date();
      const hasOverdueInvoices = invoices.some((inv) => {
        if (inv.status !== 'pending' || !inv.due_date) return false;
        const dueDate = new Date(inv.due_date);
        return dueDate < today;
      });
      newStatus = hasOverdueInvoices ? 'overdue' : 'active';
    }

    const result = await updateCustomer(customer.id, {
      blocked: newBlockedStatus,
      status: newStatus
    });

    if (result) {
      await addCreditHistory({
        customer_document: customer.document,
        event_type: 'status_change',
        description: newBlockedStatus ? 'Cliente bloqueado' : 'Cliente desbloqueado',
        registered_by: getCurrentUser()?.username || 'Sistema'
      });

      toast.success(newBlockedStatus ? 'Cliente bloqueado' : 'Cliente desbloqueado');
      loadCustomerData();
    } else {
      toast.error('Error al actualizar el estado del cliente');
    }
    setIsUpdating(false);
  };

  const handleCopyTrackingLink = () => {
    setShowTrackingLinkDialog(true);
  };

  const getStatusBadge = () => {
    if (!customer) return null;

    const styles = {
      active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      overdue: 'bg-amber-100 text-amber-700 border-amber-200',
      blocked: 'bg-red-100 text-red-700 border-red-200'
    };
    const labels = {
      active: 'Activo',
      overdue: 'Vencido',
      blocked: 'Bloqueado'
    };
    const Icon = customer.status === 'blocked' ? Ban : customer.status === 'active' ? CheckCircle : AlertCircle;

    return (
      <Badge variant="outline" className={`${styles[customer.status]} text-sm font-medium`}>
        <Icon className="w-4 h-4 mr-1" />
        {labels[customer.status]}
      </Badge>
    );
  };

  const getInvoiceStatusBadge = (invoice: Invoice) => {
    if (invoice.status === 'paid') {
      return <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">Pagado</Badge>;
    }
    if (invoice.status === 'cancelled') {
      return <Badge variant="outline" className="bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700">Cancelado</Badge>;
    }
    if (invoice.status === 'anulada') {
      return <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800">Anulada</Badge>;
    }

    if (!invoice.due_date) {
      return <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Pendiente</Badge>;
    }

    const dueDate = new Date(invoice.due_date);
    const today = new Date();
    const isOverdue = dueDate < today;

    return isOverdue ? (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">Vencido</Badge>
    ) : (
      <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">Pendiente</Badge>
    );
  };

  const getPaymentIcon = (method: string) => {
    const icons: { [key: string]: string } = {
      cash: '💵',
      transfer: '🏦',
      nequi: '📱',
      daviplata: '💳',
      other: '💰'
    };
    return icons[method] || '💰';
  };

  const getHistoryIcon = (eventType: string) => {
    const icons: { [key: string]: React.ReactNode } = {
      payment: <DollarSign className="w-4 h-4 text-emerald-600" />,
      invoice: <FileText className="w-4 h-4 text-blue-600" />,
      status_change: <AlertCircle className="w-4 h-4 text-amber-600" />,
      credit_limit_change: <CreditCard className="w-4 h-4 text-purple-600" />,
      note: <History className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />,
      credit_note: <FileX className="w-4 h-4 text-purple-600" />
    };
    return icons[eventType] || <History className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />;
  };

  const handleOpenCreditNoteModal = (invoice: Invoice) => {
    setCreditNoteInvoice(invoice);
    setCreditNoteReason('');
    setCreditNoteRefundMethod('');
    setCreditNoteAmount(0);
    setCreditNoteNotes('');
    setTargetInvoiceId('');
    const pending = invoices.filter(inv =>
      inv.is_credit && inv.status === 'pending' && inv.id !== invoice.id
    );
    setPendingCustomerInvoices(pending);
    setShowCreditNoteModal(true);
  };

  const handleIssueCreditNote = async () => {
    if (!creditNoteInvoice) return;
    if (!creditNoteReason.trim()) {
      toast.error('El motivo es obligatorio');
      return;
    }
    if (!creditNoteAmount || creditNoteAmount <= 0) {
      toast.error('El monto debe ser mayor a cero');
      return;
    }

    setIssuingCreditNote(true);
    try {
      const result = await addCreditNote(
        {
          date: '',
          invoice_id: creditNoteInvoice.id,
          invoice_number: creditNoteInvoice.number,
          customer_name: creditNoteInvoice.customer_name,
          customer_document: creditNoteInvoice.customer_document,
          items: [],
          subtotal: creditNoteAmount,
          tax: 0,
          total: creditNoteAmount,
          reason: creditNoteReason.trim(),
          refund_method: creditNoteRefundMethod || undefined,
          notes: creditNoteNotes.trim() || undefined,
          status: 'issued',
        },
        products
      );

      if (result) {
        // Abonar a otra factura pendiente
        if (creditNoteRefundMethod === 'abonar_a_factura' && targetInvoiceId) {
          const targetInvoice = pendingCustomerInvoices.find(inv => inv.id === targetInvoiceId);
          if (targetInvoice) {
            const amountToApply = Math.min(creditNoteAmount, targetInvoice.credit_balance ?? targetInvoice.total);
            const newBalance = (targetInvoice.credit_balance ?? targetInvoice.total) - amountToApply;
            await supabase
              .from('invoices')
              .update({ credit_balance: newBalance, status: newBalance <= 0 ? 'paid' : 'pending' })
              .eq('id', targetInvoiceId);
            await supabase
              .from('credit_notes')
              .update({ balance_remaining: result.balance_remaining - amountToApply })
              .eq('id', result.id);
            toast.success(`Nota Crédito ${result.number} emitida y abonada a factura #${targetInvoice.number}`);
          }
        } else {
          toast.success(`Nota Crédito ${result.number} emitida correctamente`);
        }

        // Registrar en historial de la factura
        try {
          await addHistoryMovement(creditNoteInvoice.id, {
            type: 'NOTA_CRÉDITO',
            date: new Date().toISOString(),
            performed_by: getCurrentUser()?.username || 'Usuario',
            affected_products: [],
            description: creditNoteReason.trim(),
            amount: creditNoteAmount,
          });
        } catch (histError) {
          console.error('Error writing credit note invoice history:', histError);
        }

        // Registrar en historial del cliente (SIEMPRE)
        if (creditNoteInvoice.customer_document) {
          try {
            let description = `Nota Crédito ${result.number} — Motivo: ${creditNoteReason.trim()} — Factura #${creditNoteInvoice.number}`;

            if (creditNoteRefundMethod === 'efectivo') {
              description += ' — Reembolso: Efectivo';
            } else if (creditNoteRefundMethod === 'transferencia') {
              description += ' — Reembolso: Transferencia';
            } else if (creditNoteRefundMethod === 'abonar_a_factura') {
              description += ` — Abonado a otra factura`;
            } else if (creditNoteRefundMethod === 'saldo_a_favor') {
              description += ' — Saldo a favor';
            }

            await addCreditHistory({
              customer_document: creditNoteInvoice.customer_document,
              event_type: 'credit_note',
              description,
              amount: creditNoteAmount,
              reference_id: creditNoteInvoice.id,
              registered_by: getCurrentUser()?.username || 'Usuario',
            });
          } catch (histError) {
            console.error('Error writing credit note customer history:', histError);
          }
        }

        setShowCreditNoteModal(false);
        loadCustomerData();
      } else {
        toast.error('Error al emitir la nota crédito');
      }
    } catch {
      toast.error('Error al emitir la nota crédito');
    } finally {
      setIssuingCreditNote(false);
    }
  };

  const handleOpenInvoiceSelectionModal = () => {
    if (!generalNoteAmount || generalNoteAmount <= 0) {
      toast.error('Debe establecer un monto antes de seleccionar facturas');
      return;
    }
    setShowInvoiceSelectionModal(true);
  };

  const handleConfirmInvoiceSelection = () => {
    if (selectedInvoicesForCredit.length === 0) {
      toast.error('Debe seleccionar al menos una factura');
      return;
    }

    // Calcular distribución
    const pendingInvoices = invoices.filter(inv =>
      inv.is_credit &&
      inv.status === 'pending' &&
      selectedInvoicesForCredit.includes(inv.id)
    ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Ordenar por fecha (más antiguas primero)

    let remainingAmount = generalNoteAmount;
    const distribution: typeof distributionPreview = [];

    for (const invoice of pendingInvoices) {
      const invoiceBalance = invoice.credit_balance ?? invoice.total;
      const amountToApply = Math.min(remainingAmount, invoiceBalance);

      distribution.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        amountToApply,
        remainingBalance: invoiceBalance - amountToApply,
      });

      remainingAmount -= amountToApply;
      if (remainingAmount <= 0) break;
    }

    setDistributionPreview(distribution);
    setShowInvoiceSelectionModal(false);

    // Mostrar resumen
    const totalApplied = distribution.reduce((sum, d) => sum + d.amountToApply, 0);
    const leftover = generalNoteAmount - totalApplied;

    if (leftover > 0) {
      toast.success(`Se abonarán ${formatCOP(totalApplied)} a las facturas seleccionadas y ${formatCOP(leftover)} quedarán como saldo a favor`);
    } else {
      toast.success(`Se abonarán ${formatCOP(totalApplied)} a las facturas seleccionadas`);
    }
  };

  const handleIssueGeneralCreditNote = async () => {
    if (!customer) return;
    if (!generalNoteReason.trim()) {
      toast.error('El motivo es obligatorio');
      return;
    }
    if (!generalNoteAmount || generalNoteAmount <= 0) {
      toast.error('El monto debe ser mayor a cero');
      return;
    }
    if (generalNoteRefundMethod === 'abonar_a_factura' && distributionPreview.length === 0) {
      toast.error('Debe seleccionar las facturas a las que desea abonar');
      return;
    }

    setIssuingGeneralNote(true);
    try {
      const result = await addCreditNote(
        {
          date: '',
          invoice_id: undefined,
          invoice_number: '',
          customer_name: customer.name,
          customer_document: customer.document,
          items: [],
          subtotal: generalNoteAmount,
          tax: 0,
          total: generalNoteAmount,
          reason: generalNoteReason.trim(),
          refund_method: generalNoteRefundMethod || undefined,
          notes: generalNoteNotes.trim() || undefined,
          status: 'issued',
        },
        products
      );

      if (result) {
        // Abonar a facturas según la distribución calculada
        if (generalNoteRefundMethod === 'abonar_a_factura' && distributionPreview.length > 0) {
          let totalApplied = 0;

          for (const dist of distributionPreview) {
            // Actualizar saldo de la factura
            await supabase
              .from('invoices')
              .update({
                credit_balance: dist.remainingBalance,
                status: dist.remainingBalance <= 0 ? 'paid' : 'pending'
              })
              .eq('id', dist.invoiceId);

            // Registrar en historial de la factura
            try {
              await addHistoryMovement(dist.invoiceId, {
                type: 'NOTA_CRÉDITO',
                date: new Date().toISOString(),
                performed_by: getCurrentUser()?.username || 'Usuario',
                affected_products: [],
                description: `Nota Crédito ${result.number} — ${generalNoteReason.trim()}`,
                amount: dist.amountToApply,
              });
            } catch (histError) {
              console.error('Error writing credit note invoice history:', histError);
            }

            totalApplied += dist.amountToApply;
          }

          // Actualizar el saldo restante de la nota de crédito (lo que quedó como saldo a favor)
          const leftover = generalNoteAmount - totalApplied;
          await supabase
            .from('credit_notes')
            .update({ balance_remaining: leftover })
            .eq('id', result.id);

          const invoiceNumbers = distributionPreview.map(d => `#${d.invoiceNumber}`).join(', ');
          if (leftover > 0) {
            toast.success(`Nota Crédito ${result.number} emitida. ${formatCOP(totalApplied)} abonados a facturas ${invoiceNumbers} y ${formatCOP(leftover)} como saldo a favor`);
          } else {
            toast.success(`Nota Crédito ${result.number} emitida y abonada a facturas ${invoiceNumbers}`);
          }
        } else {
          toast.success(`Nota Crédito ${result.number} emitida correctamente`);
        }

        // Registrar en historial del cliente (SIEMPRE)
        try {
          let description = `Nota Crédito ${result.number} — Motivo: ${generalNoteReason.trim()}`;

          if (generalNoteRefundMethod === 'efectivo') {
            description += ' — Reembolso: Efectivo';
          } else if (generalNoteRefundMethod === 'transferencia') {
            description += ' — Reembolso: Transferencia';
          } else if (generalNoteRefundMethod === 'abonar_a_factura') {
            description += ` — Abonado a factura(s)`;
          } else if (generalNoteRefundMethod === 'saldo_a_favor') {
            description += ' — Saldo a favor';
          }

          await addCreditHistory({
            customer_document: customer.document,
            event_type: 'credit_note',
            description,
            amount: generalNoteAmount,
            registered_by: getCurrentUser()?.username || 'Usuario',
          });
        } catch (histError) {
          console.error('Error writing credit note customer history:', histError);
        }

        setShowGeneralCreditNoteModal(false);
        setGeneralNoteReason('');
        setGeneralNoteRefundMethod('');
        setGeneralNoteAmount(0);
        setGeneralNoteNotes('');
        setGeneralNoteDueDate('');
        setGeneralTargetInvoiceId('');
        setSelectedInvoicesForCredit([]);
        setDistributionPreview([]);
        loadCustomerData();
      } else {
        toast.error('Error al emitir la nota crédito');
      }
    } catch (error) {
      console.error('Error issuing general credit note:', error);
      toast.error('Error al emitir la nota crédito');
    } finally {
      setIssuingGeneralNote(false);
    }
  };

  const handleOpenDebitNotePayment = (debitNote: any) => {
    setSelectedDebitNote(debitNote);
    setDebitNotePaymentAmount(0);
    setDebitNotePaymentMethod('');
    setDebitNotePaymentNotes('');
    setShowDebitNotePaymentModal(true);
  };

  const handleProcessDebitNotePayment = async () => {
    if (!selectedDebitNote) return;
    if (!debitNotePaymentAmount || debitNotePaymentAmount <= 0) {
      toast.error('El monto debe ser mayor a cero');
      return;
    }
    if (!debitNotePaymentMethod) {
      toast.error('Debe seleccionar un método de pago');
      return;
    }

    const balance = selectedDebitNote.balance_remaining ?? selectedDebitNote.amount;
    if (debitNotePaymentAmount > balance) {
      toast.error('El monto no puede ser mayor al saldo pendiente');
      return;
    }

    setProcessingDebitPayment(true);
    try {
      const newBalance = balance - debitNotePaymentAmount;

      // Actualizar saldo de la nota débito
      const { error: updateError } = await supabase
        .from('debit_notes')
        .update({ balance_remaining: newBalance })
        .eq('id', selectedDebitNote.id);

      if (updateError) throw updateError;

      // Registrar el pago en tabla de pagos de notas débito
      const paymentData = {
        debit_note_id: selectedDebitNote.id,
        amount: debitNotePaymentAmount,
        payment_method: debitNotePaymentMethod,
        notes: debitNotePaymentNotes.trim() || null,
        date: new Date().toISOString(),
        registered_by: getCurrentUser()?.username || 'Usuario',
        company: getCurrentCompany(),
      };

      const { error: paymentError } = await supabase
        .from('debit_note_payments')
        .insert([paymentData]);

      if (paymentError) throw paymentError;

      // Registrar en historial del cliente
      if (customer) {
        try {
          // Normalizar documento del cliente
          const normalizedDocument = customer.document.trim().replace(/\s+/g, '');
          await addCreditHistory({
            customer_document: normalizedDocument,
            event_type: 'payment',
            description: `Abono a Nota Débito ${selectedDebitNote.number || ''} — Método: ${debitNotePaymentMethod} — Saldo restante: ${formatCOP(newBalance)}`,
            amount: debitNotePaymentAmount,
            registered_by: getCurrentUser()?.username || 'Usuario',
          });
        } catch (histError) {
          console.error('Error writing debit note payment history:', histError);
        }
      }

      toast.success(newBalance <= 0
        ? `Nota Débito ${selectedDebitNote.number || ''} pagada completamente`
        : `Abono registrado. Saldo restante: ${formatCOP(newBalance)}`
      );

      // Recargar datos del cliente primero
      await loadCustomerData();

      // Luego cerrar modal y limpiar campos
      setShowDebitNotePaymentModal(false);
      setSelectedDebitNote(null);
      setDebitNotePaymentAmount(0);
      setDebitNotePaymentMethod('');
      setDebitNotePaymentNotes('');
    } catch (error) {
      console.error('Error processing debit note payment:', error);
      toast.error('Error al procesar el pago');
    } finally {
      setProcessingDebitPayment(false);
    }
  };

  const handleIssueGeneralDebitNote = async () => {
    if (!customer) return;
    if (!generalNoteReason.trim()) {
      toast.error('El motivo es obligatorio');
      return;
    }
    if (!generalNoteAmount || generalNoteAmount <= 0) {
      toast.error('El monto debe ser mayor a cero');
      return;
    }
    if (!generalNoteDueDate) {
      toast.error('La fecha de vencimiento es obligatoria');
      return;
    }

    setIssuingGeneralNote(true);
    try {
      const company = getCurrentCompany();
      const colombiaDateTime = new Date().toISOString();

      // Generar número automático
      const { data: numberData, error: numberError } = await supabase.rpc('generate_debit_note_number', {
        p_company: company,
      });

      if (numberError) throw numberError;
      const number = numberData as string;

      // Normalizar documento del cliente (eliminar espacios)
      const normalizedDocument = customer.document.trim().replace(/\s+/g, '');

      // Crear nota débito
      const debitNoteData = {
        number,
        company,
        customer_document: normalizedDocument,
        customer_name: customer.name,
        amount: generalNoteAmount,
        balance_remaining: generalNoteAmount,
        reason: generalNoteReason.trim(),
        notes: generalNoteNotes.trim() || null,
        date: colombiaDateTime,
        due_date: new Date(generalNoteDueDate).toISOString(),
        registered_by: getCurrentUser()?.username || 'Usuario',
      };

      const { data, error } = await supabase
        .from('debit_notes')
        .insert([debitNoteData])
        .select()
        .single();

      if (error) throw error;

      if (data) {
        toast.success(`Nota Débito ${number} registrada correctamente`);

        // Registrar en historial del cliente
        try {
          await addCreditHistory({
            customer_document: normalizedDocument,
            event_type: 'note',
            description: `Nota Débito ${number} — Motivo: ${generalNoteReason.trim()} — Monto: +${formatCOP(generalNoteAmount)} — Vence: ${new Date(generalNoteDueDate).toLocaleDateString('es-CO')}`,
            amount: generalNoteAmount,
            registered_by: getCurrentUser()?.username || 'Usuario',
          });
        } catch (histError) {
          console.error('Error writing debit note customer history:', histError);
        }

        // Recargar datos del cliente primero
        await loadCustomerData();

        // Luego cerrar modal y limpiar campos
        setShowGeneralDebitNoteModal(false);
        setGeneralNoteReason('');
        setGeneralNoteRefundMethod('');
        setGeneralNoteAmount(0);
        setGeneralNoteNotes('');
        setGeneralNoteDueDate('');
      }
    } catch (error) {
      console.error('Error issuing general debit note:', error);
      toast.error('Error al emitir la nota débito');
    } finally {
      setIssuingGeneralNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-zinc-500 dark:text-zinc-400">Cargando perfil del cliente...</div>
      </div>
    );
  }

  if (!customer) {
    return null;
  }

  const pendingInvoices = invoices.filter((inv) => inv.status === 'pending');
  const totalBalance = pendingInvoices.reduce((sum, inv) => sum + (inv.credit_balance || 0), 0);
  const usedCredit = totalBalance + debitNotesTotal;
  const availableCredit = customer.credit_limit - usedCredit;

  // Calcular días de mora máximo
  const today = new Date();
  let maxOverdueDays = 0;
  pendingInvoices.forEach((inv) => {
    if (inv.due_date) {
      const dueDate = new Date(inv.due_date);
      if (dueDate < today) {
        const overdueDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        if (overdueDays > maxOverdueDays) {
          maxOverdueDays = overdueDays;
        }
      }
    }
  });

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/sistema/clientes')} className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver a Clientes
          </Button>

          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <User className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">{customer.name}</h1>
                  {getStatusBadge()}
                </div>
                <div className="flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                  <span className="flex items-center gap-1">
                    <CreditCard className="w-4 h-4" />
                    {customer.document}
                  </span>
                  {customer.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-4 h-4" />
                      {customer.phone}
                    </span>
                  )}
                  {customer.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-4 h-4" />
                      {customer.email}
                    </span>
                  )}
                  {customer.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      {customer.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex gap-2">
              <Button
                onClick={handleCopyTrackingLink}
                variant="outline"
                className="border-purple-300 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950 text-xs sm:text-sm"
              >
                <Link className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden xs:inline">Link</span>
                <span className="hidden sm:inline">de Seguimiento</span>
                <Copy className="w-3 h-3 ml-1 sm:ml-2" />
              </Button>

              <Button
                onClick={() => setShowGeneralCreditNoteModal(true)}
                variant="outline"
                className="border-blue-300 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 text-xs sm:text-sm"
              >
                <TrendingDown className="w-4 h-4 mr-1 sm:mr-2" />
                Nota Crédito
              </Button>

              <Button
                onClick={() => setShowGeneralDebitNoteModal(true)}
                variant="outline"
                className="border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950 text-xs sm:text-sm"
              >
                <TrendingUp className="w-4 h-4 mr-1 sm:mr-2" />
                Nota Débito
              </Button>

              <Button
                onClick={handleToggleBlock}
                disabled={isUpdating}
                variant={customer.blocked ? 'default' : 'outline'}
                className={`${customer.blocked ? 'bg-emerald-600 hover:bg-emerald-700' : 'border-red-300 text-red-600 hover:bg-red-50'} text-xs sm:text-sm`}
              >
                {customer.blocked ? (
                  <>
                    <Unlock className="w-4 h-4 mr-1 sm:mr-2" />
                    Desbloquear
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 mr-1 sm:mr-2" />
                    Bloquear
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Métricas de Crédito */}
      <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Cupo de Crédito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatCOP(customer.credit_limit)}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Límite aprobado</p>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Crédito Usado</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{formatCOP(usedCredit)}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {customer.credit_limit > 0 ? `${((usedCredit / customer.credit_limit) * 100).toFixed(1)}% utilizado` : 'Sin cupo'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Crédito Disponible</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600">{formatCOP(availableCredit)}</div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Para nuevas compras</p>
            </CardContent>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Plazo de Pago</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{customer.payment_term} días</div>
              {maxOverdueDays > 0 && (
                <p className="text-xs text-red-600 mt-1 font-medium">{maxOverdueDays} días de mora</p>
              )}
            </CardContent>
          </Card>

          <Card className={`shadow-sm ${saldoAFavor > 0 ? 'border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Saldo a Favor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${saldoAFavor > 0 ? 'text-purple-600 dark:text-purple-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
                {formatCOP(saldoAFavor)}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {saldoAFavor > 0 ? 'Disponible en notas crédito' : 'Sin saldo a favor'}
              </p>
            </CardContent>
          </Card>

          <Card className={`shadow-sm ${debitNotesTotal > 0 ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20' : 'border-zinc-200 dark:border-zinc-800'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Nota Débito</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${debitNotesTotal > 0 ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-400 dark:text-zinc-600'}`}>
                {formatCOP(debitNotesTotal)}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {debitNotesTotal > 0 ? 'Deuda' : 'Sin deuda pendiente'}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs de Contenido */}
      <div className="p-6">
        <Tabs defaultValue="invoices" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="invoices">
              <FileText className="w-4 h-4 mr-2" />
              Facturas ({invoices.length})
            </TabsTrigger>
            <TabsTrigger value="debit_notes">
              <TrendingUp className="w-4 h-4 mr-2" />
              Nota Débito
            </TabsTrigger>
            <TabsTrigger value="payments">
              <Receipt className="w-4 h-4 mr-2" />
              Pagos
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="w-4 h-4 mr-2" />
              Historial
            </TabsTrigger>
          </TabsList>

          {/* Tab de Facturas */}
          <TabsContent value="invoices" className="space-y-4">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle>Facturas</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {invoices.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-lg font-medium">No hay facturas registradas</p>
                    <p className="text-sm mt-1">Las facturas a crédito aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Número</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Emisión</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Vencimiento</th>
                          <th className="text-center px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Días restantes</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Total</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Pagado</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Saldo</th>
                          <th className="text-center px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Estado</th>
                          <th className="text-center px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {invoices.map((invoice) => {
                          const isAnulada = invoice.status === 'anulada';
                          const paid = isAnulada ? 0 : invoice.total - (invoice.credit_balance || 0);
                          const balance = isAnulada ? 0 : (invoice.credit_balance || 0);

                          return (
                            <tr key={invoice.id} className={`hover:bg-zinc-50 dark:hover:bg-zinc-800 ${isAnulada ? 'opacity-60' : ''}`}>
                              <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                                <span className={isAnulada ? 'line-through text-zinc-400' : ''}>{invoice.number}</span>
                              </td>
                              <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                                {new Date(invoice.date).toLocaleDateString('es-CO')}
                              </td>
                              <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                                {invoice.due_date
                                  ? new Date(invoice.due_date).toLocaleDateString('es-CO')
                                  : 'Sin fecha'}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {invoice.due_date && invoice.status === 'pending' ? (() => {
                                  const today = new Date();
                                  today.setHours(0, 0, 0, 0);
                                  const due = new Date(invoice.due_date);
                                  due.setHours(0, 0, 0, 0);
                                  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
                                  const isOverdue = diff < 0;
                                  const isDueSoon = diff >= 0 && diff <= 3;
                                  return (
                                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                                      isOverdue
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                                        : isDueSoon
                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300'
                                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                    }`}>
                                      {isOverdue
                                        ? `${Math.abs(diff)}d vencida`
                                        : diff === 0
                                        ? 'Vence hoy'
                                        : `${diff}d restantes`}
                                    </span>
                                  );
                                })() : <span className="text-zinc-400 text-xs">—</span>}
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                                <span className={isAnulada ? 'line-through text-zinc-400' : ''}>{formatCOP(invoice.total)}</span>
                              </td>
                              <td className="px-6 py-4 text-right text-emerald-600">{formatCOP(paid)}</td>
                              <td className="px-6 py-4 text-right text-amber-600 font-medium">
                                {formatCOP(balance)}
                              </td>
                              <td className="px-6 py-4 text-center">{getInvoiceStatusBadge(invoice)}</td>
                              <td className="px-6 py-4 text-center">
                                {invoice.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    title="Registrar Pago"
                                    onClick={() => {
                                      setSelectedInvoice(invoice);
                                      setIsPaymentDialogOpen(true);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 px-2"
                                  >
                                    <DollarSign className="w-4 h-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Notas Débito */}
          <TabsContent value="debit_notes" className="space-y-4">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle>Notas Débito</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {debitNotes.length === 0 ? (
                  <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-lg font-medium">No hay notas débito registradas</p>
                    <p className="text-sm mt-1">Las notas débito aparecerán aquí</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-zinc-50 dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Referencia</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Fecha Emisión</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Fecha Vencimiento</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Monto Total</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Pagado</th>
                          <th className="text-right px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Saldo Pendiente</th>
                          <th className="text-left px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Motivo</th>
                          <th className="text-center px-6 py-3 text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100">
                        {debitNotes.map((debitNote) => {
                          const isOverdue = debitNote.due_date && new Date(debitNote.due_date) < new Date();
                          const balance = debitNote.balance_remaining ?? debitNote.amount;
                          const paid = debitNote.amount - balance;
                          const isPaid = balance <= 0;

                          return (
                            <tr key={debitNote.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800">
                              <td className="px-6 py-4 font-medium text-zinc-900 dark:text-zinc-100">
                                {debitNote.number || 'N/A'}
                              </td>
                              <td className="px-6 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                                {new Date(debitNote.date).toLocaleDateString('es-CO')}
                              </td>
                              <td className="px-6 py-4 text-sm">
                                <span className={isOverdue ? 'text-red-600 font-medium' : 'text-zinc-600 dark:text-zinc-400'}>
                                  {debitNote.due_date
                                    ? new Date(debitNote.due_date).toLocaleDateString('es-CO')
                                    : 'Sin fecha'}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-zinc-900 dark:text-zinc-100">
                                {formatCOP(debitNote.amount)}
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-emerald-600">
                                {formatCOP(paid)}
                              </td>
                              <td className="px-6 py-4 text-right font-medium text-orange-600">
                                {formatCOP(balance)}
                              </td>
                              <td className="px-6 py-4 text-sm text-zinc-900 dark:text-zinc-100">
                                {debitNote.reason}
                              </td>
                              <td className="px-6 py-4 text-center">
                                {!isPaid && (
                                  <Button
                                    size="sm"
                                    title="Abonar"
                                    onClick={() => handleOpenDebitNotePayment(debitNote)}
                                    className="bg-orange-600 hover:bg-orange-700 px-3 text-white"
                                  >
                                    <DollarSign className="w-4 h-4 mr-1" />
                                    Abonar
                                  </Button>
                                )}
                                {isPaid && (
                                  <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200">
                                    Pagado
                                  </Badge>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Pagos */}
          <TabsContent value="payments" className="space-y-4">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle>Historial de Pagos</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <PaymentsTab invoices={invoices} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab de Historial */}
          <TabsContent value="history" className="space-y-4">
            <Card className="border-zinc-200 dark:border-zinc-800 shadow-sm">
              <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle>Línea de Tiempo</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                {history.length === 0 ? (
                  <div className="text-center text-zinc-500 dark:text-zinc-400 py-8">
                    <History className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
                    <p className="text-lg font-medium">No hay eventos registrados</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {history.map((event, index) => (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                            {getHistoryIcon(event.event_type)}
                          </div>
                          {index < history.length - 1 && (
                            <div className="w-0.5 h-full bg-zinc-200 mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1 pb-6">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{event.description}</p>
                          {event.amount && (
                            <p className="text-sm text-emerald-600 font-medium mt-1">{formatCOP(event.amount)}</p>
                          )}
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                            {new Date(event.created_at!).toLocaleString('es-CO')} • {event.registered_by}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Payment Dialog */}
      {selectedInvoice && (
        <PaymentDialog
          isOpen={isPaymentDialogOpen}
          onClose={() => {
            setIsPaymentDialogOpen(false);
            setSelectedInvoice(null);
          }}
          invoice={selectedInvoice}
          onPaymentSuccess={loadCustomerData}
        />
      )}

      {/* Credit Note Dialog */}
      <Dialog open={showCreditNoteModal} onOpenChange={(open) => { if (!issuingCreditNote) setShowCreditNoteModal(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <FileX className="w-5 h-5 text-purple-600" />
              Emitir Nota Crédito
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Factura #{creditNoteInvoice?.number} · {creditNoteInvoice?.customer_name || 'Sin cliente'}
            </DialogDescription>
          </DialogHeader>

          {creditNoteInvoice && (
            <div className="space-y-4">
              {/* Motivo */}
              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                  Motivo <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={creditNoteReason}
                  onChange={e => setCreditNoteReason(e.target.value)}
                  placeholder="Ej: Producto defectuoso, error de precio, ajuste comercial..."
                  className="text-sm"
                />
              </div>

              {/* Método de reembolso */}
              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-700 dark:text-zinc-300">Método de reembolso</Label>
                <Select value={creditNoteRefundMethod} onValueChange={v => { setCreditNoteRefundMethod(v); setTargetInvoiceId(''); }}>
                  <SelectTrigger className="text-sm">
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                    <SelectItem value="abonar_a_factura">Abonar a otra factura</SelectItem>
                    <SelectItem value="saldo_a_favor">Saldo a favor</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Selector de factura destino */}
              {creditNoteRefundMethod === 'abonar_a_factura' && (
                <div className="space-y-1.5">
                  <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                    Factura destino
                  </Label>
                  {pendingCustomerInvoices.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 py-1.5">
                      Este cliente no tiene otras facturas a crédito pendientes.
                    </p>
                  ) : (
                    <Select value={targetInvoiceId} onValueChange={setTargetInvoiceId}>
                      <SelectTrigger className="text-sm">
                        <SelectValue placeholder="Seleccionar factura..." />
                      </SelectTrigger>
                      <SelectContent>
                        {pendingCustomerInvoices.map(inv => (
                          <SelectItem key={inv.id} value={inv.id}>
                            #{inv.number} — Saldo: {formatCOP(inv.credit_balance ?? inv.total)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}

              {/* Monto */}
              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                  Monto <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={creditNoteAmount || ''}
                  onChange={e => setCreditNoteAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="text-sm font-mono"
                />
                {creditNoteAmount > 0 && (
                  <p className="text-xs text-purple-600 dark:text-purple-400 font-medium">{formatCOP(creditNoteAmount)}</p>
                )}
              </div>

              {/* Notas adicionales */}
              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-700 dark:text-zinc-300">Notas adicionales</Label>
                <Input
                  value={creditNoteNotes}
                  onChange={e => setCreditNoteNotes(e.target.value)}
                  placeholder="Opcional..."
                  className="text-sm"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowCreditNoteModal(false)} disabled={issuingCreditNote}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleIssueCreditNote}
                  disabled={issuingCreditNote}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {issuingCreditNote ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Emitiendo...</>
                  ) : (
                    <><FileX className="w-4 h-4 mr-2" />Emitir Nota Crédito</>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tracking Link Dialog */}
      <Dialog open={showTrackingLinkDialog} onOpenChange={setShowTrackingLinkDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link className="w-5 h-5 text-purple-600" />
              Link de Seguimiento
            </DialogTitle>
            <DialogDescription>
              Comparte este link con tu cliente para que pueda ver su estado de cuenta
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Link del cliente
              </label>
              <Input
                readOnly
                value={customer ? `https://celumundo-app.vercel.app/seguimiento-cliente/${customer.id}` : ''}
                className="font-mono text-sm"
                onClick={(e) => {
                  const target = e.target as HTMLInputElement;
                  target.select();
                }}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Haz clic en el link para seleccionarlo y copiarlo
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* General Credit Note Dialog */}
      <Dialog open={showGeneralCreditNoteModal} onOpenChange={(open) => { if (!issuingGeneralNote) setShowGeneralCreditNoteModal(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <TrendingDown className="w-5 h-5 text-blue-600" />
              Emitir Nota Crédito
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Nota crédito general para {customer?.name || 'cliente'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Motivo */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                Motivo <span className="text-red-500">*</span>
              </Label>
              <Input
                value={generalNoteReason}
                onChange={e => setGeneralNoteReason(e.target.value)}
                placeholder="Ej: Ajuste comercial, bonificación, error administrativo..."
                className="text-sm"
              />
            </div>

            {/* Monto - PRIMERO */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                Monto <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={generalNoteAmount || ''}
                onChange={e => setGeneralNoteAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="text-sm font-mono"
              />
              {generalNoteAmount > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">{formatCOP(generalNoteAmount)}</p>
              )}
            </div>

            {/* Método de reembolso - SEGUNDO */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">Método de reembolso</Label>
              <Select value={generalNoteRefundMethod} onValueChange={v => { setGeneralNoteRefundMethod(v); setSelectedInvoicesForCredit([]); setDistributionPreview([]); }}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="abonar_a_factura">Abonar a factura pendiente</SelectItem>
                  <SelectItem value="saldo_a_favor">Saldo a favor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Botón para seleccionar facturas */}
            {generalNoteRefundMethod === 'abonar_a_factura' && (
              <div className="space-y-1.5">
                <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                  Facturas destino
                </Label>
                {invoices.filter(inv => inv.is_credit && inv.status === 'pending').length === 0 ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400 py-1.5">
                    Este cliente no tiene facturas a crédito pendientes.
                  </p>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleOpenInvoiceSelectionModal}
                      className="w-full justify-start text-sm"
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      {distributionPreview.length > 0
                        ? `${distributionPreview.length} factura(s) seleccionada(s)`
                        : 'Seleccionar facturas...'}
                    </Button>
                    {distributionPreview.length > 0 && (
                      <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-md border border-blue-200 dark:border-blue-800">
                        <p className="text-xs font-medium text-blue-900 dark:text-blue-100 mb-2">Distribución:</p>
                        {distributionPreview.map((dist) => (
                          <div key={dist.invoiceId} className="text-xs text-blue-700 dark:text-blue-300 flex justify-between py-1">
                            <span>Factura #{dist.invoiceNumber}:</span>
                            <span className="font-medium">{formatCOP(dist.amountToApply)}</span>
                          </div>
                        ))}
                        {generalNoteAmount - distributionPreview.reduce((sum, d) => sum + d.amountToApply, 0) > 0 && (
                          <div className="text-xs text-purple-700 dark:text-purple-300 flex justify-between py-1 border-t border-blue-200 dark:border-blue-800 mt-1 pt-1">
                            <span>Saldo a favor:</span>
                            <span className="font-medium">{formatCOP(generalNoteAmount - distributionPreview.reduce((sum, d) => sum + d.amountToApply, 0))}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Notas adicionales */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">Notas adicionales</Label>
              <Input
                value={generalNoteNotes}
                onChange={e => setGeneralNoteNotes(e.target.value)}
                placeholder="Opcional..."
                className="text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowGeneralCreditNoteModal(false)} disabled={issuingGeneralNote}>
                Cancelar
              </Button>
              <Button
                onClick={handleIssueGeneralCreditNote}
                disabled={issuingGeneralNote}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {issuingGeneralNote ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Emitiendo...</>
                ) : (
                  <><TrendingDown className="w-4 h-4 mr-2" />Emitir Nota Crédito</>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* General Debit Note Dialog */}
      <Dialog open={showGeneralDebitNoteModal} onOpenChange={(open) => { if (!issuingGeneralNote) setShowGeneralDebitNoteModal(open); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <TrendingUp className="w-5 h-5 text-orange-600" />
              Emitir Nota Débito
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Nota débito general para {customer?.name || 'cliente'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Motivo */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                Motivo <span className="text-red-500">*</span>
              </Label>
              <Input
                value={generalNoteReason}
                onChange={e => setGeneralNoteReason(e.target.value)}
                placeholder="Ej: Intereses por mora, cargos administrativos, ajuste de saldo..."
                className="text-sm"
              />
            </div>

            {/* Monto */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                Monto <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                value={generalNoteAmount || ''}
                onChange={e => setGeneralNoteAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="text-sm font-mono"
              />
              {generalNoteAmount > 0 && (
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">{formatCOP(generalNoteAmount)}</p>
              )}
            </div>

            {/* Fecha de vencimiento */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                Fecha de Vencimiento <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={generalNoteDueDate}
                onChange={e => setGeneralNoteDueDate(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Notas adicionales */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">Notas adicionales</Label>
              <Input
                value={generalNoteNotes}
                onChange={e => setGeneralNoteNotes(e.target.value)}
                placeholder="Opcional..."
                className="text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowGeneralDebitNoteModal(false)} disabled={issuingGeneralNote}>
                Cancelar
              </Button>
              <Button
                onClick={handleIssueGeneralDebitNote}
                disabled={issuingGeneralNote}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {issuingGeneralNote ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Emitiendo...</>
                ) : (
                  <><TrendingUp className="w-4 h-4 mr-2" />Emitir Nota Débito</>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Selection Modal */}
      <Dialog open={showInvoiceSelectionModal} onOpenChange={setShowInvoiceSelectionModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <FileText className="w-5 h-5 text-blue-600" />
              Seleccionar Facturas
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Monto disponible: {formatCOP(generalNoteAmount)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {invoices
              .filter(inv => inv.is_credit && inv.status === 'pending')
              .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              .map((invoice) => {
                const isSelected = selectedInvoicesForCredit.includes(invoice.id);
                const balance = invoice.credit_balance ?? invoice.total;

                return (
                  <label
                    key={invoice.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                        : 'border-zinc-200 dark:border-zinc-700 hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedInvoicesForCredit([...selectedInvoicesForCredit, invoice.id]);
                        } else {
                          setSelectedInvoicesForCredit(selectedInvoicesForCredit.filter(id => id !== invoice.id));
                        }
                      }}
                      className="w-4 h-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">
                          Factura #{invoice.number}
                        </span>
                        <span className="text-sm font-semibold text-amber-600">
                          {formatCOP(balance)}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        Fecha: {new Date(invoice.date).toLocaleDateString('es-CO')}
                        {invoice.due_date && ` • Vence: ${new Date(invoice.due_date).toLocaleDateString('es-CO')}`}
                      </div>
                    </div>
                  </label>
                );
              })}
          </div>

          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowInvoiceSelectionModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmInvoiceSelection}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Listo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debit Note Payment Modal */}
      <Dialog open={showDebitNotePaymentModal} onOpenChange={(open) => { if (!processingDebitPayment) setShowDebitNotePaymentModal(open); }}>
        <DialogContent className="max-w-md bg-white dark:bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <DollarSign className="w-5 h-5 text-orange-600" />
              Abonar a Nota Débito
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              {selectedDebitNote?.number || 'N/A'} — Saldo: {formatCOP(selectedDebitNote?.balance_remaining ?? selectedDebitNote?.amount ?? 0)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Monto */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                Monto a abonar <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                min={0}
                max={selectedDebitNote?.balance_remaining ?? selectedDebitNote?.amount ?? 0}
                value={debitNotePaymentAmount || ''}
                onChange={e => setDebitNotePaymentAmount(parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="text-sm font-mono"
              />
              {debitNotePaymentAmount > 0 && (
                <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">{formatCOP(debitNotePaymentAmount)}</p>
              )}
            </div>

            {/* Método de pago */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                Método de pago <span className="text-red-500">*</span>
              </Label>
              <Select value={debitNotePaymentMethod} onValueChange={setDebitNotePaymentMethod}>
                <SelectTrigger className="text-sm">
                  <SelectValue placeholder="Seleccionar..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Efectivo</SelectItem>
                  <SelectItem value="transfer">Transferencia</SelectItem>
                  <SelectItem value="nequi">Nequi</SelectItem>
                  <SelectItem value="daviplata">Daviplata</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">Notas</Label>
              <Input
                value={debitNotePaymentNotes}
                onChange={e => setDebitNotePaymentNotes(e.target.value)}
                placeholder="Opcional..."
                className="text-sm"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowDebitNotePaymentModal(false)} disabled={processingDebitPayment}>
                Cancelar
              </Button>
              <Button
                onClick={handleProcessDebitNotePayment}
                disabled={processingDebitPayment}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {processingDebitPayment ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Procesando...</>
                ) : (
                  <><DollarSign className="w-4 h-4 mr-2" />Registrar Abono</>
                )}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Componente para mostrar pagos
function PaymentsTab({ invoices }: { invoices: Invoice[] }) {
  const [payments, setPayments] = useState<Array<CreditPayment & { invoice_number: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [proofImageUrl, setProofImageUrl] = useState<string | null>(null);

  useEffect(() => {
    loadAllPayments();
  }, [invoices]);

  const loadAllPayments = async () => {
    setLoading(true);
    const allPayments: Array<CreditPayment & { invoice_number: string }> = [];

    for (const invoice of invoices) {
      const invoicePayments = await getCreditPaymentsByInvoice(invoice.id);
      invoicePayments.forEach((payment) => {
        allPayments.push({
          ...payment,
          invoice_number: invoice.number
        });
      });
    }

    allPayments.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    setPayments(allPayments);
    setLoading(false);
  };

  const getPaymentIcon = (method: string) => {
    const icons: { [key: string]: string } = {
      cash: '💵',
      transfer: '🏦',
      nequi: '📱',
      daviplata: '💳',
      other: '💰'
    };
    return icons[method] || '💰';
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-500 dark:text-zinc-400">
        <div className="animate-pulse">Cargando pagos...</div>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="p-12 text-center text-zinc-500 dark:text-zinc-400">
        <Receipt className="w-16 h-16 mx-auto mb-4 text-zinc-300 dark:text-zinc-600" />
        <p className="text-lg font-medium">No hay pagos registrados</p>
      </div>
    );
  }

  return (
    <>
    <div className="divide-y divide-zinc-100">
      {payments.map((payment) => (
        <div key={payment.id} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-xl">
                {getPaymentIcon(payment.payment_method)}
              </div>
              <div>
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{formatCOP(payment.amount)}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 capitalize">
                  {payment.payment_method} • Factura {payment.invoice_number}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {payment.proof_url && (
                <button
                  onClick={() => setProofImageUrl(payment.proof_url!)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 transition-colors"
                  title="Ver comprobante"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  Comprobante
                </button>
              )}
              <div className="text-right">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{new Date(payment.date).toLocaleDateString('es-CO')}</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">
                  {new Date(payment.date).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          </div>
          {payment.notes && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-2 ml-15">{payment.notes}</p>
          )}
        </div>
      ))}
    </div>

    {/* Modal comprobante */}
    <Dialog open={!!proofImageUrl} onOpenChange={(open) => { if (!open) setProofImageUrl(null); }}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>Comprobante de pago</DialogTitle>
        </DialogHeader>
        {proofImageUrl && (
          <div className="flex justify-center py-2">
            <img
              src={proofImageUrl}
              alt="Comprobante"
              className="max-w-full max-h-[65vh] object-contain rounded-lg border border-zinc-200 dark:border-zinc-700"
            />
          </div>
        )}
        <div className="flex justify-end">
          <button
            onClick={() => setProofImageUrl(null)}
            className="px-4 py-2 rounded-md border border-zinc-200 dark:border-zinc-700 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}