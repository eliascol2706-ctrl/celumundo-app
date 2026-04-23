// Servicio de impresión térmica directa

import { getPrinterConfig, printDirect } from './printer-config';
import { formatCOP } from './currency';
import { getCurrentCompany } from './supabase';

interface ThermalInvoiceOptions {
  invoice: any;
  creditPayments?: any[];
  products?: any[];
}

// Generar HTML para impresión térmica de factura
const generateThermalInvoiceHTML = (
  invoice: any,
  creditPayments: any[] = [],
  products: any[] = []
): string => {
  const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';

  // Generar HTML de productos con IDs y notas
  const productsHTML = invoice.items
    .map((item: any) => {
      // Buscar el producto para obtener las notas de las IDs
      const product = products.find((p: any) => p.id === item.productId);
      let idsHTML = '';

      if (item.unitIds && item.unitIds.length > 0) {
        const idsWithNotes = item.unitIds
          .map((id: string) => {
            let note = '';
            if (product && product.registered_ids) {
              const idObj = product.registered_ids.find((regId: any) => regId.id === id);
              if (idObj && idObj.note) {
                note = idObj.note;
              }
            }
            return note ? `${id} - (${note})` : id;
          })
          .join(' | ');

        idsHTML = `
          <div style="font-size: 7px; margin-top: 1mm; padding: 1mm; background: #f5f5f5;">
            <div>IDs: ${idsWithNotes}</div>
          </div>
        `;
      }

      return `
        <div class="product-item">
          <div style="margin-bottom: 1mm;">${item.productName}</div>
          <div>${item.quantity} x ${formatCOP(item.price)} = ${formatCOP(item.total)}</div>
          ${idsHTML}
        </div>
      `;
    })
    .join('');

  // Generar HTML de abonos si es factura a crédito
  let creditHTML = '';
  if (invoice.is_credit) {
    let paymentsHTML = '';
    if (creditPayments && creditPayments.length > 0) {
      paymentsHTML = `
        <div style="margin-bottom: 2mm; font-size: 9px;">ABONOS:</div>
        ${creditPayments
          .map(
            (payment: any) => `
          <div style="margin-bottom: 2mm; padding-bottom: 1mm; border-bottom: 1px solid black; font-size: 8px;">
            <div>${new Date(payment.date).toLocaleDateString('es-ES')}</div>
            <div>${formatCOP(payment.amount)} - ${
              payment.payment_method === 'cash'
                ? 'Efectivo'
                : payment.payment_method === 'transfer'
                ? 'Transferencia'
                : 'Otro'
            }</div>
          </div>
        `
          )
          .join('')}
        <div style="margin-top: 2mm; font-size: 9px; border-top: 1px solid black; padding-top: 2mm;">
          <div>TOTAL ABONADO: ${formatCOP(creditPayments.reduce((sum: number, p: any) => sum + p.amount, 0))}</div>
        </div>
      `;
    }

    creditHTML = `
      <div style="margin-bottom: 3mm; font-size: 8px; border: 2px solid black; padding: 2mm; background: #f5f5f5;">
        <div style="text-align: center; margin-bottom: 2mm; font-size: 11px;">FACTURA A CREDITO</div>
        ${paymentsHTML}
        <div style="margin-top: 2mm; font-size: 9px; border-top: 2px solid black; padding-top: 2mm;">
          <div style="margin-bottom: 1mm;">SALDO PENDIENTE: ${formatCOP(invoice.credit_balance || invoice.total)}</div>
          <div>ESTADO: ${invoice.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}</div>
        </div>
      </div>
    `;
  }

  // Generar HTML de métodos de pago
  let paymentHTML = '';
  if (invoice.payment_method) {
    let paymentDetails = '';
    if (invoice.payment_cash > 0 || invoice.payment_transfer > 0 || invoice.payment_other > 0) {
      const details = [];
      if (invoice.payment_cash > 0) details.push(`• Efectivo: ${formatCOP(invoice.payment_cash)}`);
      if (invoice.payment_transfer > 0)
        details.push(`• Transferencia: ${formatCOP(invoice.payment_transfer)}`);
      if (invoice.payment_other > 0) details.push(`• Otros: ${formatCOP(invoice.payment_other)}`);
      paymentDetails = details.map((d) => `<div style="margin-bottom: 1mm;">${d}</div>`).join('');
    } else {
      paymentDetails = `<div>${invoice.payment_method}</div>`;
    }

    paymentHTML = `
      <div style="margin-bottom: 3mm; font-size: 8px; border-bottom: 1px solid black; padding-bottom: 2mm;">
        <div style="margin-bottom: 1mm; font-size: 9px;">METODO DE PAGO:</div>
        ${paymentDetails}
      </div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            size: 80mm auto;
            margin: 0;
            padding: 0;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            width: 70mm;
            max-width: 70mm;
            font-family: 'Arial', 'Helvetica', sans-serif;
            font-size: 9px;
            font-weight: 900;
            padding: 2mm 3mm;
            background: white;
            color: black;
            margin: 0;
            line-height: 1.4;
          }
          div, span, p, b, strong {
            font-weight: 900 !important;
          }
          .header {
            text-align: center;
            margin-bottom: 3mm;
            border-bottom: 2px solid black;
            padding-bottom: 2mm;
          }
          .info {
            margin-bottom: 3mm;
            font-size: 8px;
            border-bottom: 1px solid black;
            padding-bottom: 2mm;
          }
          .products {
            margin-bottom: 3mm;
            border-bottom: 1px solid black;
            padding-bottom: 2mm;
          }
          .product-item {
            margin-bottom: 2mm;
            font-size: 8px;
          }
          .total-section {
            margin: 3mm 0;
            border-top: 2px solid black;
            border-bottom: 2px solid black;
            padding: 3mm 0;
            text-align: center;
            background: #f0f0f0;
          }
          .total-label {
            font-size: 11px;
            margin-bottom: 2mm;
          }
          .total-amount {
            font-size: 14px;
          }
          .footer {
            text-align: center;
            font-size: 8px;
            margin-top: 3mm;
            padding-top: 2mm;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div style="font-size: 12px; margin-bottom: 2mm;">${companyName}</div>
          <div style="font-size: 10px; margin-bottom: 1mm;">FACTURA</div>
          <div style="font-size: 9px;">No. ${invoice.number}</div>
        </div>

        <div class="info">
          <div style="margin-bottom: 1mm;">Cliente: ${invoice.customer_name || 'Consumidor Final'}</div>
          ${
            invoice.customer_document
              ? `<div style="margin-bottom: 1mm;">Doc: ${invoice.customer_document}</div>`
              : ''
          }
          <div style="margin-bottom: 1mm;">Fecha: ${new Date(invoice.date).toLocaleString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}</div>
          ${
            invoice.attended_by
              ? `<div>Vendedor: ${invoice.attended_by}</div>`
              : ''
          }
        </div>

        <div class="products">
          <div style="text-align: center; font-size: 9px; margin-bottom: 2mm;">PRODUCTOS</div>
          ${productsHTML}
        </div>

        <div class="total-section">
          <div class="total-label">TOTAL</div>
          <div class="total-amount">${formatCOP(invoice.total)}</div>
        </div>

        ${paymentHTML}
        ${creditHTML}

        <div class="footer">
          <div style="margin: 2mm 0; border-top: 1px solid black; padding-top: 2mm;"></div>
          <div style="font-size: 10px; margin-bottom: 2mm;">GRACIAS POR SU COMPRA</div>
          <div style="font-size: 9px; margin-bottom: 1mm;">${companyName}</div>
          <div style="margin-bottom: 1mm;">www.celumundovip.com</div>
          <div style="font-size: 7px;">${new Date().toLocaleString('es-ES')}</div>
        </div>

        <!-- Espacio adicional para que la factura salga completa -->
        <div style="height: 30mm; width: 100%;"></div>

        <!-- Comando de corte de papel (ESC/POS) -->
        <div style="page-break-after: always;"></div>
      </body>
    </html>
  `;
};

// Imprimir factura térmica directamente
export const printThermalInvoice = async (options: ThermalInvoiceOptions): Promise<boolean> => {
  try {
    const config = await getPrinterConfig();

    if (!config.thermal) {
      throw new Error('No se ha configurado una impresora térmica. Ve a Configuración para configurarla.');
    }

    const html = generateThermalInvoiceHTML(
      options.invoice,
      options.creditPayments || [],
      options.products || []
    );

    const success = await printDirect(config.thermal, html, 'thermal');

    if (!success) {
      throw new Error('Error al enviar el documento a la impresora');
    }

    return true;
  } catch (error) {
    console.error('Error al imprimir factura térmica:', error);
    throw error;
  }
};
