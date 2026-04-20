// Servicio de impresión PDF directa (Formato A4)

import { getPrinterConfig, printDirect } from './printer-config';
import { formatCOP } from './currency';
import { getCurrentCompany } from './supabase';

interface PDFInvoiceOptions {
  invoice: any;
  creditPayments?: any[];
  products?: any[];
}

// Generar HTML para impresión PDF de factura (A4)
const generatePDFInvoiceHTML = (
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
          <div style="font-size: 9pt; color: #666; margin-top: 4px; padding-left: 20px;">
            <strong>IDs:</strong> ${idsWithNotes}
          </div>
        `;
      }

      return `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">
            <div style="font-weight: 500;">${item.productName}</div>
            ${idsHTML}
          </td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">${formatCOP(item.price)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 500;">${formatCOP(item.total)}</td>
        </tr>
      `;
    })
    .join('');

  // Generar HTML de abonos si es factura a crédito
  let creditHTML = '';
  if (invoice.is_credit) {
    let paymentsHTML = '';
    if (creditPayments && creditPayments.length > 0) {
      const paymentsRows = creditPayments
        .map(
          (payment: any) => `
        <tr>
          <td style="padding: 6px; border-bottom: 1px solid #e0e0e0;">${new Date(payment.date).toLocaleDateString('es-ES')}</td>
          <td style="padding: 6px; border-bottom: 1px solid #e0e0e0;">
            ${payment.payment_method === 'cash' ? 'Efectivo' : payment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}
          </td>
          <td style="padding: 6px; border-bottom: 1px solid #e0e0e0; text-align: right; font-weight: 500;">${formatCOP(payment.amount)}</td>
        </tr>
      `
        )
        .join('');

      const totalAbonos = creditPayments.reduce((sum: number, p: any) => sum + p.amount, 0);

      paymentsHTML = `
        <div style="margin-top: 30px;">
          <h3 style="color: #1976d2; margin-bottom: 15px;">Historial de Abonos</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f5f5f5;">
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Fecha</th>
                <th style="padding: 8px; text-align: left; border-bottom: 2px solid #ddd;">Método</th>
                <th style="padding: 8px; text-align: right; border-bottom: 2px solid #ddd;">Monto</th>
              </tr>
            </thead>
            <tbody>
              ${paymentsRows}
            </tbody>
            <tfoot>
              <tr style="font-weight: bold; background-color: #f9f9f9;">
                <td colspan="2" style="padding: 10px; border-top: 2px solid #ddd;">Total Abonado:</td>
                <td style="padding: 10px; text-align: right; border-top: 2px solid #ddd;">${formatCOP(totalAbonos)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    const saldoPendiente = invoice.credit_balance || invoice.total;
    const isPaid = invoice.status === 'paid';

    creditHTML = `
      <div style="margin-top: 30px; padding: 20px; background-color: ${isPaid ? '#e8f5e9' : '#fff3e0'}; border-left: 4px solid ${isPaid ? '#4caf50' : '#ff9800'}; border-radius: 4px;">
        <h3 style="color: ${isPaid ? '#2e7d32' : '#e65100'}; margin-top: 0;">FACTURA A CRÉDITO</h3>
        ${paymentsHTML}
        <div style="margin-top: 20px; font-size: 16pt;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <strong>Saldo Pendiente:</strong>
            <strong style="color: ${isPaid ? '#4caf50' : '#e65100'}; font-size: 18pt;">${formatCOP(saldoPendiente)}</strong>
          </div>
          <div style="text-align: right; font-size: 12pt; color: #666;">
            Estado: <span style="color: ${isPaid ? '#4caf50' : '#e65100'}; font-weight: bold;">${isPaid ? 'PAGADO' : 'PENDIENTE'}</span>
          </div>
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
      if (invoice.payment_cash > 0) details.push(`<li>Efectivo: ${formatCOP(invoice.payment_cash)}</li>`);
      if (invoice.payment_transfer > 0) details.push(`<li>Transferencia: ${formatCOP(invoice.payment_transfer)}</li>`);
      if (invoice.payment_other > 0) details.push(`<li>Otros: ${formatCOP(invoice.payment_other)}</li>`);
      paymentDetails = `<ul style="margin: 5px 0; padding-left: 20px;">${details.join('')}</ul>`;
    } else {
      paymentDetails = `<p style="margin: 5px 0;">${invoice.payment_method}</p>`;
    }

    paymentHTML = `
      <div style="margin-top: 20px;">
        <h4 style="margin-bottom: 10px;">Método de Pago:</h4>
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
            size: A4;
            margin: 15mm;
          }
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid #1976d2;
          }
          .company-name {
            font-size: 24pt;
            font-weight: bold;
            color: #1976d2;
            margin-bottom: 10px;
          }
          .invoice-title {
            font-size: 18pt;
            font-weight: bold;
            color: #666;
            margin-bottom: 5px;
          }
          .invoice-number {
            font-size: 14pt;
            color: #666;
          }
          .info-section {
            margin-bottom: 25px;
            padding: 15px;
            background-color: #f5f5f5;
            border-radius: 4px;
          }
          .info-row {
            margin-bottom: 8px;
            font-size: 11pt;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .total-section {
            text-align: right;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 2px solid #ddd;
          }
          .total-line {
            font-size: 18pt;
            font-weight: bold;
            color: #1976d2;
            margin-top: 10px;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 10pt;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <div class="company-name">${companyName}</div>
            <div class="invoice-title">FACTURA DE VENTA</div>
            <div class="invoice-number">No. ${invoice.number}</div>
          </div>

          <!-- Info -->
          <div class="info-section">
            <div class="info-row">
              <span class="info-label">Cliente:</span> ${invoice.customer_name || 'Consumidor Final'}
            </div>
            ${invoice.customer_document ? `
            <div class="info-row">
              <span class="info-label">Documento:</span> ${invoice.customer_document}
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Fecha:</span> ${new Date(invoice.date).toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div class="info-row">
              <span class="info-label">Tipo:</span> ${invoice.type === 'regular' ? 'Regular' : 'Al Mayor'}
            </div>
            ${invoice.attended_by ? `
            <div class="info-row">
              <span class="info-label">Atendido por:</span> ${invoice.attended_by}
            </div>
            ` : ''}
          </div>

          <!-- Products -->
          <table>
            <thead>
              <tr style="background-color: #1976d2; color: white;">
                <th style="padding: 10px; text-align: left; width: 80px;">Cant.</th>
                <th style="padding: 10px; text-align: left;">Producto</th>
                <th style="padding: 10px; text-align: right; width: 120px;">Precio</th>
                <th style="padding: 10px; text-align: right; width: 120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productsHTML}
            </tbody>
          </table>

          <!-- Total -->
          <div class="total-section">
            <div class="total-line">
              TOTAL: ${formatCOP(invoice.total)}
            </div>
          </div>

          ${paymentHTML}
          ${creditHTML}

          <!-- Footer -->
          <div class="footer">
            <p><strong>${companyName}</strong></p>
            <p>www.celumundovip.com</p>
            <p>${new Date().toLocaleString('es-ES')}</p>
          </div>
        </div>
      </body>
    </html>
  `;
};

// Imprimir factura PDF directamente
export const printPDFInvoice = async (options: PDFInvoiceOptions): Promise<boolean> => {
  try {
    const config = await getPrinterConfig();

    if (!config.pdf) {
      throw new Error('No se ha configurado una impresora PDF. Ve a Configuración para configurarla.');
    }

    const html = generatePDFInvoiceHTML(
      options.invoice,
      options.creditPayments || [],
      options.products || []
    );

    const success = await printDirect(config.pdf, html, 'pdf');

    if (!success) {
      throw new Error('Error al enviar el documento a la impresora');
    }

    return true;
  } catch (error) {
    console.error('Error al imprimir factura PDF:', error);
    throw error;
  }
};
