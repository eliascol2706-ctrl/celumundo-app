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
          <div style="font-size: 10pt; margin-top: 2mm; padding: 2mm; background: #f5f5f5; border: 1px solid #ddd;">
            <div style="font-weight: bold; margin-bottom: 1mm;">IDs:</div>
            <div>${idsWithNotes}</div>
          </div>
        `;
      }

      return `
        <div style="margin-bottom: 4mm; font-size: 11pt;">
          <div style="font-weight: bold; margin-bottom: 1.5mm; font-size: 12pt;">${item.productName}</div>
          <div style="margin-bottom: 1.5mm;">
            ${item.quantity} x ${formatCOP(item.price)} = ${formatCOP(item.total)}
          </div>
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
        <div style="font-weight: bold; margin-bottom: 2mm; font-size: 12pt;">Abonos:</div>
        ${creditPayments
          .map(
            (payment: any) => `
          <div style="margin-bottom: 3mm; padding-bottom: 2mm; border-bottom: 1px dotted #ccc;">
            <div style="display: flex; justify-content: space-between;">
              <span>${new Date(payment.date).toLocaleDateString('es-ES')}</span>
              <span>${formatCOP(payment.amount)}</span>
            </div>
            <div style="font-size: 10pt; margin-top: 1mm;">
              ${
                payment.payment_method === 'cash'
                  ? 'Efectivo'
                  : payment.payment_method === 'transfer'
                  ? 'Transferencia'
                  : 'Otro'
              }
            </div>
          </div>
        `
          )
          .join('')}
        <div style="font-weight: bold; margin-top: 3mm; font-size: 12pt;">
          <div style="display: flex; justify-content: space-between;">
            <span>Total Abonado:</span>
            <span>${formatCOP(creditPayments.reduce((sum: number, p: any) => sum + p.amount, 0))}</span>
          </div>
        </div>
      `;
    }

    creditHTML = `
      <div style="margin-bottom: 5mm; font-size: 11pt; border-bottom: 1px dashed black; padding-bottom: 4mm;">
        <div style="font-weight: bold; text-align: center; margin-bottom: 3mm; font-size: 13pt;">FACTURA A CRÉDITO</div>
        ${paymentsHTML}
        <div style="font-weight: bold; margin-top: 3mm; font-size: 12pt;">
          <div style="display: flex; justify-content: space-between;">
            <span>Saldo Pendiente:</span>
            <span>${formatCOP(invoice.credit_balance || invoice.total)}</span>
          </div>
        </div>
        <div style="margin-top: 2mm; font-size: 10pt;">
          Estado: ${invoice.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
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
      paymentDetails = details.map((d) => `<div style="margin-bottom: 1.5mm;">${d}</div>`).join('');
    } else {
      paymentDetails = `<div>${invoice.payment_method}</div>`;
    }

    paymentHTML = `
      <div style="margin-bottom: 5mm; font-size: 11pt; border-bottom: 1px dashed black; padding-bottom: 4mm;">
        <div style="font-weight: bold; margin-bottom: 2mm; font-size: 12pt;">Método de Pago:</div>
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
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            width: 80mm;
            font-family: 'Courier New', Courier, monospace;
            font-size: 12pt;
            padding: 4mm 3mm 6mm 3mm;
            background: white;
            color: black;
            margin: 0 auto;
            line-height: 1.3;
          }
        </style>
      </head>
      <body>
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 5mm; border-bottom: 2px dashed black; padding-bottom: 4mm;">
          <div style="font-size: 18pt; font-weight: bold; margin-bottom: 2mm; letter-spacing: 1px;">${companyName}</div>
          <div style="font-size: 14pt; font-weight: bold; margin-bottom: 2mm;">FACTURA DE VENTA</div>
          <div style="font-size: 13pt; font-weight: bold;">No. ${invoice.number}</div>
        </div>

        <!-- Info -->
        <div style="margin-bottom: 5mm; font-size: 11pt; border-bottom: 1px dashed black; padding-bottom: 4mm;">
          <div style="margin-bottom: 2mm;">
            <span style="font-weight: bold;">Cliente: </span>
            <span>${invoice.customer_name || 'Consumidor Final'}</span>
          </div>
          ${
            invoice.customer_document
              ? `
          <div style="margin-bottom: 2mm;">
            <span style="font-weight: bold;">Documento: </span>
            <span>${invoice.customer_document}</span>
          </div>
          `
              : ''
          }
          <div style="margin-bottom: 2mm;">
            <span style="font-weight: bold;">Fecha: </span>
            <span>${new Date(invoice.date).toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}</span>
          </div>
          <div style="margin-bottom: 2mm;">
            <span style="font-weight: bold;">Tipo: </span>
            <span>${invoice.type === 'regular' ? 'Regular' : 'Al Mayor'}</span>
          </div>
          ${
            invoice.attended_by
              ? `
          <div style="margin-bottom: 2mm;">
            <span style="font-weight: bold;">Atendido: </span>
            <span>${invoice.attended_by}</span>
          </div>
          `
              : ''
          }
        </div>

        <!-- Products -->
        <div style="margin-bottom: 5mm; border-bottom: 2px dashed black; padding-bottom: 4mm;">
          <div style="font-size: 13pt; font-weight: bold; text-align: center; margin-bottom: 3mm;">PRODUCTOS</div>
          ${productsHTML}
        </div>

        <!-- Total -->
        <div style="margin-bottom: 5mm; font-size: 12pt;">
          <div style="font-size: 15pt; font-weight: bold; border-top: 3px double black; padding-top: 3mm; margin-top: 2mm; display: flex; justify-content: space-between;">
            <span>TOTAL:</span>
            <span>${formatCOP(invoice.total)}</span>
          </div>
        </div>

        ${paymentHTML}
        ${creditHTML}

        <!-- Footer -->
        <div style="text-align: center; font-size: 11pt; margin-top: 5mm; padding-top: 3mm; padding-bottom: 5mm;">
          <div style="margin-bottom: 3mm;">================================</div>
          <div style="font-weight: bold; margin-top: 3mm; margin-bottom: 3mm; font-size: 14pt;">
            ¡GRACIAS POR SU COMPRA!
          </div>
          <div style="margin-top: 3mm; margin-bottom: 2mm; font-size: 12pt; font-weight: bold;">
            ${companyName}
          </div>
          <div style="margin-bottom: 2mm; font-size: 11pt;">
            www.celumundovip.com
          </div>
          <div style="font-size: 10pt; margin-top: 2mm; margin-bottom: 3mm;">
            ${new Date().toLocaleString('es-ES')}
          </div>
        </div>

        <!-- Espacio adicional para que la factura salga completa -->
        <div style="height: 50mm; width: 100%;"></div>
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
