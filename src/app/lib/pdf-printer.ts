// Servicio de impresión PDF directa (Formato A4)

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { getPrinterConfig, printDirect } from './printer-config';
import { formatCOP } from './currency';
import { getCurrentCompany } from './supabase';

interface PDFInvoiceOptions {
  invoice: any;
  creditPayments?: any[];
  products?: any[];
}

// Generar HTML para impresión PDF de factura (A4) — diseño profesional B&N
const generatePDFInvoiceHTML = (
  invoice: any,
  creditPayments: any[] = [],
  products: any[] = []
): string => {
  const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';

  const invoiceDate = new Date(invoice.date).toLocaleString('es-ES', {
    timeZone: 'America/Bogota',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Filas de productos
  const productsRows = invoice.items
    .map((item: any, idx: number) => {
      const product = products.find((p: any) => p.id === item.productId);
      let idsText = '';
      if (item.unitIds && item.unitIds.length > 0) {
        const idsWithNotes = item.unitIds
          .map((id: string) => {
            if (product?.registered_ids) {
              const idObj = product.registered_ids.find((r: any) => r.id === id);
              return idObj?.note ? `${id} (${idObj.note})` : id;
            }
            return id;
          })
          .join(', ');
        idsText = `<div style="font-size:7.5pt;color:#555;margin-top:2px;">IDs: ${idsWithNotes}</div>`;
      }
      const bg = idx % 2 === 0 ? '#fff' : '#f7f7f7';
      return `
        <tr style="background:${bg};">
          <td style="padding:6px 8px;border-bottom:1px solid #e0e0e0;text-align:center;width:40px;">${item.quantity}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e0e0e0;">
            <span style="font-size:9pt;">${item.productName}</span>${idsText}
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #e0e0e0;text-align:right;width:100px;font-size:9pt;">${formatCOP(item.price)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e0e0e0;text-align:right;width:110px;font-size:9pt;font-weight:600;">${formatCOP(item.total)}</td>
        </tr>`;
    })
    .join('');

  // Método de pago
  let paymentText = '';
  if (invoice.payment_method) {
    const parts: string[] = [];
    if (invoice.payment_cash > 0) parts.push(`Efectivo: ${formatCOP(invoice.payment_cash)}`);
    if (invoice.payment_transfer > 0) parts.push(`Transferencia: ${formatCOP(invoice.payment_transfer)}`);
    if (invoice.payment_other > 0) parts.push(`Otros: ${formatCOP(invoice.payment_other)}`);
    paymentText = parts.length > 0 ? parts.join(' &nbsp;|&nbsp; ') : invoice.payment_method;
  }

  // Abonos (crédito)
  let creditSection = '';
  if (invoice.is_credit) {
    const saldo = invoice.credit_balance ?? invoice.total;
    const isPaid = invoice.status === 'paid';
    let abonosRows = '';
    if (creditPayments.length > 0) {
      abonosRows = creditPayments.map(p => {
        const method = p.payment_method === 'cash' ? 'Efectivo'
          : p.payment_method === 'transfer' ? 'Transferencia' : p.payment_method;
        return `<tr>
          <td style="padding:4px 8px;border-bottom:1px solid #e8e8e8;font-size:8.5pt;">${new Date(p.date).toLocaleDateString('es-ES')}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e8e8e8;font-size:8.5pt;">${method}</td>
          <td style="padding:4px 8px;border-bottom:1px solid #e8e8e8;text-align:right;font-size:8.5pt;font-weight:600;">${formatCOP(p.amount)}</td>
        </tr>`;
      }).join('');
      const totalAbonado = creditPayments.reduce((s: number, p: any) => s + p.amount, 0);
      abonosRows += `<tr style="background:#f0f0f0;">
        <td colspan="2" style="padding:5px 8px;font-size:8.5pt;font-weight:700;">Total abonado</td>
        <td style="padding:5px 8px;text-align:right;font-size:8.5pt;font-weight:700;">${formatCOP(totalAbonado)}</td>
      </tr>`;
    }

    creditSection = `
      <div style="margin-top:16px;border:1px solid #ccc;border-radius:3px;overflow:hidden;">
        <div style="background:#1a1a1a;color:#fff;padding:7px 10px;font-size:9pt;font-weight:700;letter-spacing:0.5px;">
          FACTURA A CRÉDITO &nbsp;·&nbsp; ${isPaid ? 'SALDADA' : 'PENDIENTE'}
        </div>
        ${abonosRows ? `
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr style="background:#f0f0f0;">
            <th style="padding:5px 8px;text-align:left;font-size:8pt;border-bottom:1px solid #ddd;">Fecha</th>
            <th style="padding:5px 8px;text-align:left;font-size:8pt;border-bottom:1px solid #ddd;">Método</th>
            <th style="padding:5px 8px;text-align:right;font-size:8pt;border-bottom:1px solid #ddd;">Monto</th>
          </tr></thead>
          <tbody>${abonosRows}</tbody>
        </table>` : ''}
        <div style="padding:8px 10px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid #ddd;">
          <span style="font-size:9pt;font-weight:700;">Saldo pendiente:</span>
          <span style="font-size:12pt;font-weight:800;">${formatCOP(saldo)}</span>
        </div>
      </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 14mm 14mm;
    }
    * {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      box-sizing: border-box;
      margin: 0; padding: 0;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 9pt;
      color: #1a1a1a;
      background: #fff;
      line-height: 1.4;
    }
    table { border-collapse: collapse; width: 100%; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  </style>
</head>
<body>

  <!-- ENCABEZADO -->
  <table style="width:100%;margin-bottom:12px;">
    <tr>
      <td style="vertical-align:top;">
        <div style="font-size:18pt;font-weight:800;letter-spacing:-0.5px;line-height:1;">${companyName}</div>
        <div style="font-size:8.5pt;color:#555;margin-top:3px;">www.celumundovip.com</div>
      </td>
      <td style="text-align:right;vertical-align:top;">
        <div style="font-size:13pt;font-weight:700;letter-spacing:0.5px;">FACTURA DE VENTA</div>
        <div style="font-size:11pt;font-weight:600;margin-top:2px;">N° ${invoice.number}</div>
        <div style="font-size:8pt;color:#555;margin-top:3px;">${invoiceDate}</div>
      </td>
    </tr>
  </table>

  <div style="border-top:2px solid #1a1a1a;border-bottom:1px solid #ccc;padding:8px 0;margin-bottom:12px;">
    <table style="width:100%;">
      <tr>
        <td style="width:50%;vertical-align:top;padding-right:16px;">
          <div style="font-size:7.5pt;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:3px;">Cliente</div>
          <div style="font-size:9.5pt;font-weight:600;">${invoice.customer_name || 'Consumidor Final'}</div>
          ${invoice.customer_document ? `<div style="font-size:8.5pt;color:#444;">Doc: ${invoice.customer_document}</div>` : ''}
        </td>
        <td style="width:50%;vertical-align:top;">
          <div style="font-size:7.5pt;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:3px;">Información</div>
          <div style="font-size:8.5pt;">Tipo: ${invoice.type === 'wholesale' ? 'Al Mayor' : 'Regular'}</div>
          ${invoice.attended_by ? `<div style="font-size:8.5pt;">Vendedor: ${invoice.attended_by}</div>` : ''}
        </td>
      </tr>
    </table>
  </div>

  <!-- TABLA DE PRODUCTOS -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:0;">
    <thead>
      <tr style="background:#1a1a1a;color:#fff;">
        <th style="padding:7px 8px;text-align:center;width:40px;font-size:8.5pt;font-weight:700;">Cant.</th>
        <th style="padding:7px 8px;text-align:left;font-size:8.5pt;font-weight:700;">Descripción</th>
        <th style="padding:7px 8px;text-align:right;width:100px;font-size:8.5pt;font-weight:700;">Precio Unit.</th>
        <th style="padding:7px 8px;text-align:right;width:110px;font-size:8.5pt;font-weight:700;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${productsRows}
    </tbody>
  </table>

  <!-- TOTALES -->
  <table style="width:100%;border-collapse:collapse;margin-top:0;">
    <tr>
      <td style="width:60%;"></td>
      <td style="width:40%;">
        ${invoice.tax > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:5px 8px;border-top:1px solid #ddd;font-size:8.5pt;">
          <span>Subtotal:</span><span>${formatCOP(invoice.subtotal)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:5px 8px;border-top:1px solid #ddd;font-size:8.5pt;">
          <span>IVA:</span><span>${formatCOP(invoice.tax)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:8px 8px;background:#1a1a1a;color:#fff;border-radius:2px;margin-top:2px;">
          <span style="font-size:10pt;font-weight:700;">TOTAL</span>
          <span style="font-size:12pt;font-weight:800;">${formatCOP(invoice.total)}</span>
        </div>
      </td>
    </tr>
  </table>

  <!-- MÉTODO DE PAGO -->
  ${paymentText ? `
  <div style="margin-top:10px;padding:6px 10px;background:#f4f4f4;border-radius:3px;font-size:8.5pt;">
    <strong>Método de pago:</strong> ${paymentText}
  </div>` : ''}

  <!-- SECCIÓN CRÉDITO -->
  ${creditSection}

  <!-- FIRMA -->
  <div style="margin-top:30px;">
    <table style="width:100%;">
      <tr>
        <td style="width:45%;text-align:center;vertical-align:bottom;padding-top:30px;border-top:1px solid #1a1a1a;font-size:8pt;color:#555;">
          Firma del cliente
        </td>
        <td style="width:10%;"></td>
        <td style="width:45%;text-align:center;vertical-align:bottom;padding-top:30px;border-top:1px solid #1a1a1a;font-size:8pt;color:#555;">
          Firma del vendedor
        </td>
      </tr>
    </table>
  </div>

  <!-- PIE -->
  <div style="margin-top:14px;border-top:1px solid #ddd;padding-top:7px;text-align:center;font-size:7.5pt;color:#888;">
    ${companyName} &nbsp;·&nbsp; Gracias por su compra &nbsp;·&nbsp; ${new Date().toLocaleDateString('es-ES')}
  </div>

</body>
</html>`;
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

// Generar Blob PDF descargable usando html2canvas + jsPDF
export const generatePDFBlob = async (options: PDFInvoiceOptions): Promise<Blob> => {
  const html = generatePDFInvoiceHTML(
    options.invoice,
    options.creditPayments || [],
    options.products || []
  );

  // Renderizar el HTML en un iframe oculto para capturarlo
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;height:1123px;border:none;';
  document.body.appendChild(iframe);

  await new Promise<void>(resolve => {
    iframe.onload = () => resolve();
    const doc = iframe.contentWindow!.document;
    doc.open();
    doc.write(html);
    doc.close();
    // fallback si onload no dispara
    setTimeout(resolve, 800);
  });

  await new Promise(r => setTimeout(r, 400));

  const body = iframe.contentWindow!.document.body;
  // Add padding to simulate A4 margins in the canvas render
  body.style.padding = '20mm 14mm';
  body.style.boxSizing = 'border-box';

  const canvas = await html2canvas(body, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: 794,
  });

  document.body.removeChild(iframe);

  const imgData = canvas.toDataURL('image/jpeg', 0.92);
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;

  let yOffset = 0;
  while (yOffset < imgH) {
    if (yOffset > 0) pdf.addPage();
    pdf.addImage(imgData, 'JPEG', 0, -yOffset, pageW, imgH);
    yOffset += pageH;
  }

  return pdf.output('blob');
};

// Descargar factura PDF en el navegador (sin impresora)
export const downloadPDFInvoice = (options: PDFInvoiceOptions): void => {
  const html = generatePDFInvoiceHTML(
    options.invoice,
    options.creditPayments || [],
    options.products || []
  );

  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;

  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow?.focus();
  setTimeout(() => {
    iframe.contentWindow?.print();
    setTimeout(() => document.body.removeChild(iframe), 2000);
  }, 500);
};
