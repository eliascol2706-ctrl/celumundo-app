import { formatCOP } from '../lib/currency';
import { getCurrentCompany } from '../lib/supabase';

interface ThermalInvoicePrintProps {
  invoice: any;
  creditPayments?: any[];
}

export function ThermalInvoicePrint({ invoice, creditPayments = [] }: ThermalInvoicePrintProps) {
  const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
  
  return (
    <>
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }
        
        @media print {
          body {
            width: 80mm;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>
      
      <div style={{
        width: '80mm',
        fontFamily: "'Courier New', Courier, monospace",
        fontSize: '12pt',
        padding: '4mm 3mm 6mm 3mm',
        background: 'white',
        color: 'black',
        margin: '0 auto',
        lineHeight: '1.3',
      }}>
        
        {/* Header */}
        <div style={{
          textAlign: 'center',
          marginBottom: '5mm',
          borderBottom: '2px dashed black',
          paddingBottom: '4mm',
        }}>
          <div style={{
            fontSize: '18pt',
            fontWeight: 'bold',
            marginBottom: '2mm',
            letterSpacing: '1px',
          }}>{companyName}</div>
          <div style={{
            fontSize: '14pt',
            fontWeight: 'bold',
            marginBottom: '2mm',
          }}>FACTURA DE VENTA</div>
          <div style={{
            fontSize: '13pt',
            fontWeight: 'bold',
          }}>No. {invoice.number}</div>
        </div>
        
        {/* Info */}
        <div style={{
          marginBottom: '5mm',
          fontSize: '11pt',
          borderBottom: '1px dashed black',
          paddingBottom: '4mm',
        }}>
          <div style={{ marginBottom: '2mm' }}>
            <span style={{ fontWeight: 'bold' }}>Cliente: </span>
            <span>{invoice.customer_name || 'Consumidor Final'}</span>
          </div>
          {invoice.customer_document && (
            <div style={{ marginBottom: '2mm' }}>
              <span style={{ fontWeight: 'bold' }}>Documento: </span>
              <span>{invoice.customer_document}</span>
            </div>
          )}
          <div style={{ marginBottom: '2mm' }}>
            <span style={{ fontWeight: 'bold' }}>Fecha: </span>
            <span>{new Date(invoice.date).toLocaleString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</span>
          </div>
          <div style={{ marginBottom: '2mm' }}>
            <span style={{ fontWeight: 'bold' }}>Tipo: </span>
            <span>{invoice.type === 'regular' ? 'Regular' : 'Al Mayor'}</span>
          </div>
          <div style={{ marginBottom: '2mm' }}>
            <span style={{ fontWeight: 'bold' }}>Atendido: </span>
            <span>{invoice.attended_by || 'N/A'}</span>
          </div>
        </div>
        
        {/* Products */}
        <div style={{
          marginBottom: '5mm',
          borderBottom: '2px dashed black',
          paddingBottom: '4mm',
        }}>
          <div style={{
            fontSize: '13pt',
            fontWeight: 'bold',
            textAlign: 'center',
            marginBottom: '3mm',
          }}>PRODUCTOS</div>
          
          {invoice.items.map((item: any, index: number) => (
            <div key={index} style={{
              marginBottom: '4mm',
              fontSize: '11pt',
            }}>
              <div style={{
                fontWeight: 'bold',
                marginBottom: '1.5mm',
                fontSize: '12pt',
              }}>{item.productName}</div>
              <div style={{ marginBottom: '1.5mm' }}>
                {item.quantity} x ${formatCOP(item.price)} = ${formatCOP(item.total)}
              </div>
              {item.unitIds && item.unitIds.length > 0 && (
                <div style={{
                  fontSize: '10pt',
                  marginTop: '2mm',
                  padding: '2mm',
                  background: '#f5f5f5',
                  border: '1px solid #ddd',
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    marginBottom: '1mm',
                  }}>IDs:</div>
                  <div>{item.unitIds.join(', ')}</div>
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Totals */}
        <div style={{
          marginBottom: '5mm',
          fontSize: '12pt',
        }}>
          <div style={{
            fontSize: '15pt',
            fontWeight: 'bold',
            borderTop: '3px double black',
            paddingTop: '3mm',
            marginTop: '2mm',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <span>TOTAL:</span>
            <span>${formatCOP(invoice.total)}</span>
          </div>
        </div>
        
        {/* Payment */}
        <div style={{
          marginBottom: '5mm',
          fontSize: '11pt',
          borderBottom: '1px dashed black',
          paddingBottom: '4mm',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '2mm', fontSize: '12pt' }}>Método de Pago:</div>
          {invoice.payment_method === 'cash' && <div>Efectivo</div>}
          {invoice.payment_method === 'transfer' && <div>Transferencia</div>}
          {invoice.payment_method === 'mixed' && (
            <>
              <div>Mixto:</div>
              <div>• Efectivo: ${formatCOP(invoice.payment_cash || 0)}</div>
              <div>• Transferencia: ${formatCOP(invoice.payment_transfer || 0)}</div>
            </>
          )}
        </div>
        
        {/* Credit Section */}
        {invoice.is_credit && (
          <div style={{
            marginBottom: '5mm',
            fontSize: '11pt',
            borderBottom: '1px dashed black',
            paddingBottom: '4mm',
          }}>
            <div style={{
              fontWeight: 'bold',
              textAlign: 'center',
              marginBottom: '3mm',
              fontSize: '13pt',
            }}>FACTURA A CRÉDITO</div>
            
            {creditPayments && creditPayments.length > 0 && (
              <>
                <div style={{ fontWeight: 'bold', marginBottom: '2mm', fontSize: '12pt' }}>Abonos:</div>
                {creditPayments.map((payment: any, index: number) => (
                  <div key={index} style={{
                    marginBottom: '3mm',
                    paddingBottom: '2mm',
                    borderBottom: '1px dotted #ccc',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{new Date(payment.date).toLocaleDateString('es-ES')}</span>
                      <span>${formatCOP(payment.amount)}</span>
                    </div>
                    <div style={{ fontSize: '10pt', marginTop: '1mm' }}>
                      {payment.payment_method === 'cash' ? 'Efectivo' : 
                       payment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}
                    </div>
                  </div>
                ))}
                <div style={{
                  fontWeight: 'bold',
                  marginTop: '3mm',
                  fontSize: '12pt',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Total Abonado:</span>
                    <span>${formatCOP(creditPayments.reduce((sum: number, p: any) => sum + p.amount, 0))}</span>
                  </div>
                </div>
              </>
            )}
            
            <div style={{
              fontWeight: 'bold',
              marginTop: '3mm',
              fontSize: '12pt',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Saldo Pendiente:</span>
                <span>${formatCOP(invoice.credit_balance || invoice.total)}</span>
              </div>
            </div>
            <div style={{ marginTop: '2mm', fontSize: '10pt' }}>
              Estado: {invoice.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
            </div>
          </div>
        )}
        
        {/* Footer */}
        <div style={{
          textAlign: 'center',
          fontSize: '11pt',
          marginTop: '5mm',
          paddingTop: '3mm',
          paddingBottom: '5mm',
        }}>
          <div style={{ marginBottom: '3mm' }}>
            ================================
          </div>
          <div style={{
            fontWeight: 'bold',
            marginTop: '3mm',
            marginBottom: '3mm',
            fontSize: '14pt',
          }}>
            ¡GRACIAS POR SU COMPRA!
          </div>
          <div style={{ marginTop: '3mm', marginBottom: '2mm', fontSize: '12pt', fontWeight: 'bold' }}>
            {companyName}
          </div>
          <div style={{ marginBottom: '2mm', fontSize: '11pt' }}>
            www.celumundovip.com
          </div>
          <div style={{ fontSize: '10pt', marginTop: '2mm', marginBottom: '3mm' }}>
            {new Date().toLocaleString('es-ES')}
          </div>
        </div>
      </div>
    </>
  );
}