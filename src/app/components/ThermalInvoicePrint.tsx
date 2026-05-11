import { formatCOP } from '../lib/currency';
import { getCurrentCompany } from '../lib/supabase';

interface ThermalInvoicePrintProps {
  invoice: any;
  creditPayments?: any[];
  products?: any[];
}

export function ThermalInvoicePrint({ invoice, creditPayments = [], products = [] }: ThermalInvoicePrintProps) {
  const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';

  const totalAbonado = creditPayments.reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
  const saldoPendiente = invoice.credit_balance ?? (invoice.total - totalAbonado);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  };

  const printTimestamp = (() => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  })();

  /* ── Estilos base reutilizables ── */
  const divider: React.CSSProperties = {
    borderBottom: '1px dashed #999',
    margin: '2mm 0',
  };

  const dividerSolid: React.CSSProperties = {
    borderBottom: '1px solid #000',
    margin: '2.5mm 0',
  };

  return (
    <>
      <style>{`
        @page {
          size: 80mm auto;
          margin: 0;
        }

        @media print {
          html, body {
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

        .thermal-receipt * {
          box-sizing: border-box;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
        }
      `}</style>

      <div
        className="thermal-receipt"
        style={{
          width: '80mm',
          maxWidth: '80mm',
          fontFamily: "'Arial', 'Helvetica Neue', Helvetica, sans-serif",
          fontSize: '11px',
          fontWeight: 500,
          lineHeight: 1.55,
          letterSpacing: '0px',
          padding: '3mm 4mm 0 4mm',
          background: 'white',
          color: '#000',
          margin: '0 auto',
        }}
      >

        {/* ── ENCABEZADO ── */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '15px',
            fontWeight: 800,
            letterSpacing: '0.4px',
            marginBottom: '1.5mm',
            color: '#000',
          }}>
            {companyName}
          </div>

          <div style={divider} />

          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.6px',
            marginBottom: '1.5mm',
            marginTop: '1.5mm',
            color: '#000',
          }}>
            FACTURA DE VENTA
          </div>

          <div style={divider} />

          <div style={{
            fontSize: '12px',
            fontWeight: 500,
            letterSpacing: '0.2px',
            marginTop: '1.5mm',
            marginBottom: '1.5mm',
            color: '#000',
          }}>
            No. {invoice.number}
          </div>
        </div>

        <div style={dividerSolid} />

        {/* ── INFORMACIÓN DEL CLIENTE ── */}
        <div style={{ marginBottom: '1.5mm' }}>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '1.5mm',
            fontSize: '11px',
            color: '#000',
          }}>
            <span style={{ fontWeight: 500 }}>Cliente:</span>
            <span style={{ fontWeight: 700, textAlign: 'right', maxWidth: '55mm', wordBreak: 'break-word' }}>
              {invoice.customer_name || 'Consumidor Final'}
            </span>
          </div>

          {invoice.customer_document && (
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '1.5mm',
              fontSize: '11px',
              color: '#000',
            }}>
              <span style={{ fontWeight: 500 }}>Documento:</span>
              <span style={{ fontWeight: 700 }}>{invoice.customer_document}</span>
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '1.5mm',
            fontSize: '11px',
            color: '#000',
          }}>
            <span style={{ fontWeight: 500 }}>Fecha:</span>
            <span style={{ fontWeight: 500 }}>{formatDate(invoice.date)}</span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '1.5mm',
            fontSize: '11px',
            color: '#000',
          }}>
            <span style={{ fontWeight: 500 }}>Tipo:</span>
            <span style={{ fontWeight: 500 }}>
              {invoice.type === 'regular' ? 'Regular' : 'Al Mayor'}
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '1.5mm',
            fontSize: '11px',
            color: '#000',
          }}>
            <span style={{ fontWeight: 500 }}>Atendido por:</span>
            <span style={{ fontWeight: 500 }}>{invoice.attended_by || 'N/A'}</span>
          </div>
        </div>

        <div style={dividerSolid} />

        {/* ── PRODUCTOS ── */}
        <div style={{ marginBottom: '2mm' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.8px',
            textAlign: 'center',
            margin: '2.5mm 0',
            color: '#000',
          }}>
            PRODUCTOS
          </div>

          {invoice.items.map((item: any, index: number) => {
            const product = products.find((p: any) => p.id === item.productId);

            return (
              <div
                key={index}
                style={{
                  marginBottom: '2.5mm',
                  paddingBottom: '2.5mm',
                  borderBottom: '1px dotted #666',
                }}
              >
                {/* Nombre del producto */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '0.1px',
                  marginBottom: '1.5mm',
                  wordBreak: 'break-word',
                  color: '#000',
                }}>
                  {item.productName}
                </div>

                {/* Detalle cantidad × precio = total */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontWeight: 500,
                  letterSpacing: '0px',
                  color: '#000',
                }}>
                  <span>{item.quantity} x {formatCOP(item.price)}</span>
                  <span style={{ fontWeight: 800 }}>{formatCOP(item.total)}</span>
                </div>

                {/* IDs de unidades */}
                {item.unitIds && item.unitIds.length > 0 && (
                  <div style={{
                    fontSize: '10px',
                    fontWeight: 500,
                    background: '#f0f0f0',
                    borderLeft: '2px solid #333',
                    padding: '1.5mm',
                    lineHeight: 1.5,
                    letterSpacing: '0px',
                    marginTop: '1.5mm',
                    color: '#000',
                  }}>
                    <span style={{ fontWeight: 700 }}>IDs:</span>{' '}
                    {item.unitIds.map((id: string, idx: number) => {
                      let note = '';
                      if (product && product.registered_ids) {
                        const idObj = product.registered_ids.find((regId: any) => regId.id === id);
                        if (idObj && idObj.note) note = idObj.note;
                      }
                      return (
                        <span key={idx}>
                          {idx > 0 && ' | '}
                          <span style={{ fontWeight: 700 }}>{id}</span>
                          {note && <span> - ({note})</span>}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── TOTAL A PAGAR ── */}
        <div style={{
          background: '#f0f0f0',
          border: '2px solid #000',
          padding: '3mm 4mm',
          textAlign: 'center',
          marginBottom: '2.5mm',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.8px',
            marginBottom: '1.5mm',
            color: '#000',
          }}>
            TOTAL A PAGAR
          </div>
          <div style={{
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '0.2px',
            color: '#000',
          }}>
            {formatCOP(invoice.total)}
          </div>
        </div>

        {/* ── MÉTODO DE PAGO ── */}
        {invoice.payment_method && (
          <div style={{
            background: '#fafafa',
            border: '1px solid #000',
            padding: '2mm',
            marginBottom: '2.5mm',
          }}>
            <div style={{
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.4px',
              textAlign: 'center',
              marginBottom: '1.5mm',
              color: '#000',
            }}>
              MÉTODO DE PAGO
            </div>

            {(invoice.payment_cash > 0 || invoice.payment_transfer > 0 || invoice.payment_other > 0) ? (
              <div style={{ fontSize: '11px', color: '#000' }}>
                {invoice.payment_cash > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 500,
                    marginBottom: '1mm',
                  }}>
                    <span>Efectivo:</span>
                    <span style={{ fontWeight: 700 }}>{formatCOP(invoice.payment_cash)}</span>
                  </div>
                )}
                {invoice.payment_transfer > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 500,
                    marginBottom: '1mm',
                  }}>
                    <span>Transferencia:</span>
                    <span style={{ fontWeight: 700 }}>{formatCOP(invoice.payment_transfer)}</span>
                  </div>
                )}
                {invoice.payment_other > 0 && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontWeight: 500,
                    marginBottom: '1mm',
                  }}>
                    <span>Otros:</span>
                    <span style={{ fontWeight: 700 }}>{formatCOP(invoice.payment_other)}</span>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '11px', fontWeight: 500, textAlign: 'center', color: '#000' }}>
                {invoice.payment_method}
              </div>
            )}
          </div>
        )}

        {/* ── SECCIÓN CRÉDITO ── */}
        {invoice.is_credit && (
          <div style={{
            background: '#f0f0f0',
            border: '2px solid #000',
            padding: '2mm 3mm',
            marginBottom: '2.5mm',
          }}>
            <div style={{
              fontSize: '13px',
              fontWeight: 800,
              letterSpacing: '0.4px',
              textAlign: 'center',
              marginBottom: '2mm',
              color: '#000',
            }}>
              FACTURA A CRÉDITO
            </div>

            {creditPayments && creditPayments.length > 0 && (
              <>
                <div style={divider} />
                <div style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  marginBottom: '1.5mm',
                  marginTop: '1.5mm',
                  color: '#000',
                }}>
                  Abonos realizados:
                </div>

                {creditPayments.map((payment: any, index: number) => (
                  <div key={index} style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    lineHeight: 1.5,
                    marginBottom: '1mm',
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#000',
                  }}>
                    <span>
                      {new Date(payment.date).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      {' · '}
                      {payment.payment_method === 'cash' ? 'Efectivo' :
                       payment.payment_method === 'transfer' ? 'Transferencia' : 'Otro'}
                    </span>
                    <span style={{ fontWeight: 700 }}>{formatCOP(payment.amount)}</span>
                  </div>
                ))}

                <div style={divider} />

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  fontWeight: 500,
                  marginBottom: '1.5mm',
                  marginTop: '1.5mm',
                  color: '#000',
                }}>
                  <span>Total abonado:</span>
                  <span style={{ fontWeight: 700 }}>{formatCOP(totalAbonado)}</span>
                </div>
              </>
            )}

            <div style={divider} />

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '12px',
              fontWeight: 800,
              letterSpacing: '0.2px',
              marginTop: '1.5mm',
              marginBottom: '1.5mm',
              color: '#000',
            }}>
              <span>Saldo pendiente:</span>
              <span>{formatCOP(saldoPendiente > 0 ? saldoPendiente : 0)}</span>
            </div>

            <div style={{
              fontSize: '11px',
              fontWeight: 500,
              textAlign: 'center',
              marginTop: '1mm',
              color: '#000',
            }}>
              Estado: <span style={{ fontWeight: 800 }}>
                {invoice.status === 'paid' ? 'PAGADO' : 'PENDIENTE'}
              </span>
            </div>
          </div>
        )}

        {/* ── FOOTER ── */}
        <div style={divider} />

        <div style={{
          textAlign: 'center',
          padding: '2mm 0',
        }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 800,
            letterSpacing: '0.4px',
            marginBottom: '1.5mm',
            color: '#000',
          }}>
            ¡GRACIAS POR SU COMPRA!
          </div>

          <div style={divider} />

          <div style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.1px',
            marginTop: '1.5mm',
            marginBottom: '1mm',
            color: '#000',
          }}>
            {companyName}
          </div>
          <div style={{
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.1px',
            marginBottom: '1mm',
            color: '#000',
          }}>
            www.celumundovip.com
          </div>
          <div style={{
            fontSize: '10px',
            fontWeight: 500,
            letterSpacing: '0px',
            color: '#333',
            marginTop: '1mm',
          }}>
            Impreso: {printTimestamp}
          </div>
        </div>

        {/* ── ESPACIO DE ARRASTRE ── */}
        <div style={{ height: '80mm', width: '100%' }} />
        <div style={{ pageBreakAfter: 'always' }} />

      </div>
    </>
  );
}