import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { formatCOP } from '../lib/currency';
import { CheckCircle, Clock, AlertCircle, Package, Shield, Phone, CreditCard, User, Hash } from 'lucide-react';

interface InvoiceItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number;
  total: number;
  unitIds?: string[];
}

interface Invoice {
  id: string;
  number: string;
  company: string;
  date: string;
  customer_name?: string;
  customer_document?: string;
  customer_phone?: string;
  attended_by?: string;
  items: InvoiceItem[];
  total: number;
  payment_method?: string;
  status: string;
  is_credit?: boolean;
  credit_balance?: number;
  warranty_enabled?: boolean;
  warranty_months?: number;
  warranty_category?: string;
  type?: string;
}

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  paid: { label: 'Pagada', color: 'text-emerald-600', icon: CheckCircle },
  pending: { label: 'Pendiente', color: 'text-amber-500', icon: Clock },
  partial_return: { label: 'Devolución Parcial', color: 'text-orange-500', icon: AlertCircle },
  pending_confirmation: { label: 'En Confirmación', color: 'text-blue-500', icon: Clock },
  anulada: { label: 'Anulada', color: 'text-zinc-400', icon: AlertCircle },
};

const warrantyText = {
  dispositivos:
    'GARANTÍA: Cubre únicamente defectos de fabricación y fallas técnicas no ocasionadas por el usuario. No cubre golpes, caídas, humedad, líquidos, manipulación o reparación no autorizada, accesorios incompatibles, desgaste normal, uso inadecuado ni daños en el pin/puerto de carga del celular. Toda garantía está sujeta a diagnóstico técnico. No se efectuará ningún proceso de garantía sin la caja original del producto. La garantía no cubre pérdida de datos o información.',
  electrodomesticos:
    'GARANTÍA: Cubre únicamente defectos de fabricación y fallas técnicas no ocasionadas por el usuario. No cubre golpes, caídas, humedad, líquidos, daños eléctricos, fluctuaciones de voltaje, manipulación o reparación no autorizada, instalación incorrecta, desgaste normal ni uso inadecuado. Toda garantía está sujeta a diagnóstico técnico. No se efectuará ningún proceso de garantía sin la caja original del producto.',
};

export default function PublicInvoice() {
  const { number } = useParams<{ number: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!number) { setError('Número de factura no proporcionado.'); setLoading(false); return; }
    loadInvoice(number);
  }, [number]);

  const loadInvoice = async (num: string) => {
    try {
      const { data, error: dbError } = await supabase
        .from('invoices')
        .select('*')
        .eq('number', num)
        .single();

      if (dbError || !data) {
        setError('Factura no encontrada. Verifica el número e intenta nuevamente.');
      } else {
        setInvoice(data as Invoice);
      }
    } catch {
      setError('Error al cargar la factura. Intenta más tarde.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 font-medium">Cargando factura...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-zinc-800">Factura no encontrada</h2>
          <p className="text-zinc-500 text-sm">{error}</p>
          <p className="text-xs text-zinc-400">Factura N° {number}</p>
        </div>
      </div>
    );
  }

  const companyName = invoice.company === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
  const status = statusConfig[invoice.status] || { label: invoice.status, color: 'text-zinc-500', icon: Clock };
  const StatusIcon = status.icon;
  const isWarranty = invoice.warranty_enabled && invoice.warranty_months;
  const warrantyDesc = invoice.warranty_category === 'electrodomesticos'
    ? warrantyText.electrodomesticos : warrantyText.dispositivos;
  const warrantyLabel = invoice.warranty_category === 'electrodomesticos'
    ? 'Electrodomésticos' : 'Dispositivos electrónicos';

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header empresa */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="bg-zinc-900 px-6 py-5 flex items-center justify-between">
            <div>
              <h1 className="text-white font-bold text-xl tracking-tight">{companyName}</h1>
              <p className="text-zinc-400 text-xs mt-0.5">www.celumundovip.com</p>
            </div>
            <div className="text-right">
              <p className="text-zinc-400 text-xs uppercase tracking-widest">Factura de Venta</p>
              <p className="text-white font-mono font-bold text-2xl mt-0.5">#{invoice.number}</p>
            </div>
          </div>

          {/* Estado + fecha */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-zinc-100">
            <div className="flex items-center gap-2">
              <StatusIcon className={`w-4 h-4 ${status.color}`} />
              <span className={`text-sm font-semibold ${status.color}`}>{status.label}</span>
            </div>
            <span className="text-xs text-zinc-400">{formatDate(invoice.date)}</span>
          </div>

          {/* Datos cliente */}
          <div className="px-6 py-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-start gap-3">
              <User className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-zinc-400 uppercase tracking-wide mb-0.5">Cliente</p>
                <p className="text-sm font-semibold text-zinc-800">{invoice.customer_name || 'Consumidor Final'}</p>
              </div>
            </div>
            {invoice.customer_document && (
              <div className="flex items-start gap-3">
                <CreditCard className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide mb-0.5">Cédula</p>
                  <p className="text-sm font-semibold text-zinc-800">{invoice.customer_document}</p>
                </div>
              </div>
            )}
            {invoice.customer_phone && (
              <div className="flex items-start gap-3">
                <Phone className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide mb-0.5">Teléfono</p>
                  <p className="text-sm font-semibold text-zinc-800">{invoice.customer_phone}</p>
                </div>
              </div>
            )}
            {invoice.attended_by && (
              <div className="flex items-start gap-3">
                <Hash className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-zinc-400 uppercase tracking-wide mb-0.5">Atendido por</p>
                  <p className="text-sm font-semibold text-zinc-800">{invoice.attended_by}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Productos */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-zinc-500" />
            <h2 className="font-semibold text-zinc-800 text-sm">Productos ({invoice.items.length})</h2>
          </div>
          <div className="divide-y divide-zinc-50">
            {invoice.items.map((item, idx) => (
              <div key={idx} className="px-6 py-3.5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-800 truncate">{item.productName}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{item.quantity} × {formatCOP(item.price)}</p>
                    {item.unitIds && item.unitIds.length > 0 && (
                      <p className="text-xs text-zinc-400 mt-0.5 font-mono">
                        IDs: {item.unitIds.join(', ')}
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-bold text-zinc-900 shrink-0">{formatCOP(item.total)}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-4 bg-zinc-900 flex items-center justify-between rounded-b-2xl">
            <span className="text-zinc-300 text-sm font-medium">TOTAL</span>
            <span className="text-white text-xl font-bold">{formatCOP(invoice.total)}</span>
          </div>
        </div>

        {/* Método de pago */}
        {invoice.payment_method && (
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 px-6 py-4">
            <p className="text-xs text-zinc-400 uppercase tracking-wide mb-1">Método de pago</p>
            <p className="text-sm font-semibold text-zinc-800">{invoice.payment_method}</p>
          </div>
        )}

        {/* Crédito */}
        {invoice.is_credit && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl px-6 py-4">
            <p className="text-xs text-blue-600 uppercase tracking-wide font-semibold mb-1">Factura a crédito</p>
            {invoice.credit_balance != null && invoice.credit_balance > 0 && (
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm text-blue-700">Saldo pendiente:</span>
                <span className="text-base font-bold text-blue-800">{formatCOP(invoice.credit_balance)}</span>
              </div>
            )}
          </div>
        )}

        {/* Garantía */}
        {isWarranty && (
          <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 overflow-hidden">
            <div className="bg-zinc-900 px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span className="text-white font-bold text-sm">GARANTÍA INCLUIDA — {warrantyLabel}</span>
              </div>
              <span className="text-emerald-400 font-bold text-sm">
                {invoice.warranty_months} {invoice.warranty_months === 1 ? 'MES' : 'MESES'}
              </span>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-zinc-500 leading-relaxed">{warrantyDesc}</p>
            </div>
          </div>
        )}

        {/* Sello de verificación */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-200 px-6 py-5 text-center space-y-1">
          <div className="flex items-center justify-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Factura verificada</span>
          </div>
          <p className="text-xs text-zinc-400">
            Esta factura fue emitida por <strong className="text-zinc-600">{companyName}</strong> y puede ser
            verificada en cualquier momento mediante este enlace.
          </p>
          <p className="text-xs text-zinc-400 font-mono mt-1">N° {invoice.number}</p>
        </div>

      </div>
    </div>
  );
}
