import { formatCOP } from '../lib/currency';
import { getCurrentCompany } from '../lib/supabase';

interface ThermalClosurePrintProps {
  closureType: 'daily' | 'monthly';
  closureData: any;
  invoices?: any[];
}

export function ThermalClosurePrint({ closureType, closureData, invoices = [] }: ThermalClosurePrintProps) {
  const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
  
  return (
    <div className="thermal-print-wrapper">
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          
          body {
            margin: 0;
            padding: 0;
          }
          
          /* Ocultar todo excepto la tirilla térmica */
          body * {
            visibility: hidden;
          }
          
          .thermal-print-wrapper,
          .thermal-print-wrapper * {
            visibility: visible;
          }
          
          .thermal-print-wrapper {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            padding: 2mm;
            background: white;
            color: black;
          }
          
          .thermal-header {
            text-align: center;
            margin-bottom: 3mm;
            border-bottom: 2px solid black;
            padding-bottom: 2mm;
          }
          
          .thermal-title {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 1mm;
          }
          
          .thermal-subtitle {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 1mm;
          }
          
          .thermal-section {
            margin-bottom: 3mm;
            padding-bottom: 2mm;
            border-bottom: 1px dashed black;
          }
          
          .thermal-section-title {
            font-size: 11pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 2mm;
          }
          
          .thermal-info-line {
            margin-bottom: 1mm;
            font-size: 9pt;
            display: flex;
            justify-content: space-between;
          }
          
          .thermal-label {
            font-weight: bold;
          }
          
          .thermal-total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1mm;
            font-size: 10pt;
          }
          
          .thermal-total-final {
            font-size: 13pt;
            font-weight: bold;
            border-top: 2px solid black;
            padding-top: 2mm;
            margin-top: 2mm;
            display: flex;
            justify-content: space-between;
          }
          
          .thermal-footer {
            text-align: center;
            font-size: 9pt;
            margin-top: 4mm;
            padding-top: 2mm;
            border-top: 2px solid black;
          }
          
          .thermal-footer-line {
            margin-bottom: 1mm;
          }
          
          .no-print {
            display: none !important;
          }
        }
        
        /* Estilos para vista previa en pantalla */
        @media screen {
          .thermal-print-wrapper {
            width: 80mm;
            font-family: 'Courier New', monospace;
            font-size: 10pt;
            padding: 2mm;
            background: white;
            color: black;
            margin: 0 auto;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
          }
          
          .thermal-header {
            text-align: center;
            margin-bottom: 3mm;
            border-bottom: 2px solid black;
            padding-bottom: 2mm;
          }
          
          .thermal-title {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 1mm;
          }
          
          .thermal-subtitle {
            font-size: 12pt;
            font-weight: bold;
            margin-bottom: 1mm;
          }
          
          .thermal-section {
            margin-bottom: 3mm;
            padding-bottom: 2mm;
            border-bottom: 1px dashed black;
          }
          
          .thermal-section-title {
            font-size: 11pt;
            font-weight: bold;
            text-align: center;
            margin-bottom: 2mm;
          }
          
          .thermal-info-line {
            margin-bottom: 1mm;
            font-size: 9pt;
            display: flex;
            justify-content: space-between;
          }
          
          .thermal-label {
            font-weight: bold;
          }
          
          .thermal-total-line {
            display: flex;
            justify-content: space-between;
            margin-bottom: 1mm;
            font-size: 10pt;
          }
          
          .thermal-total-final {
            font-size: 13pt;
            font-weight: bold;
            border-top: 2px solid black;
            padding-top: 2mm;
            margin-top: 2mm;
            display: flex;
            justify-content: space-between;
          }
          
          .thermal-footer {
            text-align: center;
            font-size: 9pt;
            margin-top: 4mm;
            padding-top: 2mm;
            border-top: 2px solid black;
          }
          
          .thermal-footer-line {
            margin-bottom: 1mm;
          }
        }
      `}</style>
      
      <div className="thermal-header">
        <div className="thermal-title">{companyName}</div>
        <div className="thermal-subtitle">
          {closureType === 'daily' ? 'CIERRE DIARIO' : 'CIERRE MENSUAL'}
        </div>
        <div style={{ fontSize: '9pt', marginTop: '1mm' }}>
          {closureType === 'daily' 
            ? new Date(closureData.date).toLocaleDateString('es-ES')
            : `${closureData.month} - ${closureData.year}`
          }
        </div>
      </div>
      
      {closureType === 'daily' && (
        <>
          <div className="thermal-section">
            <div className="thermal-section-title">RESUMEN DE VENTAS</div>
            <div className="thermal-info-line">
              <span className="thermal-label">Facturas Totales:</span>
              <span>{closureData.total_invoices}</span>
            </div>
            <div className="thermal-info-line">
              <span className="thermal-label">Pagadas:</span>
              <span>{closureData.paid_invoices || 0}</span>
            </div>
            <div className="thermal-info-line">
              <span className="thermal-label">Pendientes:</span>
              <span>{closureData.pending_invoices || 0}</span>
            </div>
          </div>
          
          <div className="thermal-section">
            <div className="thermal-section-title">INGRESOS</div>
            <div className="thermal-total-line">
              <span>Efectivo:</span>
              <span>${formatCOP(closureData.total_cash || 0)}</span>
            </div>
            <div className="thermal-total-line">
              <span>Transferencia:</span>
              <span>${formatCOP(closureData.total_transfer || 0)}</span>
            </div>
            <div className="thermal-total-final">
              <span>TOTAL:</span>
              <span>${formatCOP(closureData.total)}</span>
            </div>
          </div>
          
          {invoices && invoices.length > 0 && (
            <div className="thermal-section">
              <div className="thermal-section-title">DETALLE DE FACTURAS</div>
              {invoices.slice(0, 10).map((invoice: any, index: number) => (
                <div key={index} style={{ marginBottom: '1.5mm', fontSize: '8pt', paddingBottom: '1mm', borderBottom: '1px dotted #ccc' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                    <span>{invoice.number}</span>
                    <span>${formatCOP(invoice.total)}</span>
                  </div>
                  <div style={{ fontSize: '7pt' }}>
                    {invoice.customer_name || 'Consumidor Final'}
                  </div>
                </div>
              ))}
              {invoices.length > 10 && (
                <div style={{ textAlign: 'center', fontSize: '8pt', marginTop: '2mm' }}>
                  ... y {invoices.length - 10} facturas más
                </div>
              )}
            </div>
          )}
        </>
      )}
      
      {closureType === 'monthly' && (
        <>
          <div className="thermal-section">
            <div className="thermal-section-title">RESUMEN DEL MES</div>
            <div className="thermal-info-line">
              <span className="thermal-label">Facturas Totales:</span>
              <span>{closureData.totalInvoices}</span>
            </div>
            <div className="thermal-info-line">
              <span className="thermal-label">Días con Ventas:</span>
              <span>{closureData.totalDays || 0}</span>
            </div>
          </div>
          
          <div className="thermal-section">
            <div className="thermal-section-title">INGRESOS DEL MES</div>
            <div className="thermal-total-final">
              <span>TOTAL:</span>
              <span>${formatCOP(closureData.totalRevenue)}</span>
            </div>
          </div>
        </>
      )}
      
      <div className="thermal-footer">
        <div className="thermal-footer-line">
          <strong>Cerrado por:</strong> {closureData.closed_by || closureData.closedBy}
        </div>
        <div className="thermal-footer-line" style={{ fontSize: '8pt' }}>
          {new Date(closureData.closed_at || new Date()).toLocaleString('es-ES')}
        </div>
        <div className="thermal-footer-line" style={{ marginTop: '3mm', borderTop: '1px dashed black', paddingTop: '2mm' }}>
          ================================
        </div>
        <div style={{ fontWeight: 'bold', fontSize: '10pt', marginTop: '2mm' }}>
          {companyName}
        </div>
        <div className="thermal-footer-line">
          www.celumundovip.com
        </div>
      </div>
      
      {/* Espacio adicional para que el cierre salga completo de la impresora */}
      <div style={{ height: '50mm', width: '100%' }}></div>
    </div>
  );
}