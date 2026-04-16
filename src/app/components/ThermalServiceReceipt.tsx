import { formatCOP } from '../lib/currency';
import { extractColombiaDateTime, getCurrentCompany } from '../lib/supabase';
import type { ServiceOrder, Technician } from '../lib/service-orders';

interface ThermalServiceReceiptProps {
  order: ServiceOrder;
  technician?: Technician;
  receiptType: 'reception' | 'delivery';
}

export function ThermalServiceReceipt({ order, technician, receiptType }: ThermalServiceReceiptProps) {
  const companyName = getCurrentCompany() === 'celumundo' ? 'CELUMUNDO VIP' : 'REPUESTOS VIP';
  const isReception = receiptType === 'reception';

  return (
    <div style={{
      width: '80mm',
      fontFamily: 'monospace',
      fontSize: '12px',
      padding: '10px',
      backgroundColor: 'white',
      color: 'black',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '15px' }}>
        <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
          {companyName}
        </div>
        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '10px' }}>
          SERVICIO TÉCNICO
        </div>
        <div style={{ fontSize: '12px', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '5px 0' }}>
          {isReception ? 'COMPROBANTE DE RECEPCIÓN' : 'COMPROBANTE DE ENTREGA'}
        </div>
      </div>

      {/* Información de la Orden */}
      <div style={{ marginBottom: '10px', fontSize: '11px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontWeight: 'bold' }}>Orden:</span>
          <span>{order.order_number}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontWeight: 'bold' }}>Código Seguimiento:</span>
          <span style={{ fontSize: '10px' }}>{order.tracking_code}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
          <span style={{ fontWeight: 'bold' }}>Fecha:</span>
          <span>{extractColombiaDateTime(isReception ? order.received_date : (order.actual_delivery_date || order.received_date))}</span>
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      {/* Datos del Cliente */}
      <div style={{ marginBottom: '10px', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>DATOS DEL CLIENTE</div>
        <div style={{ marginBottom: '3px' }}>
          <span style={{ fontWeight: 'bold' }}>Nombre:</span> {order.customer_name}
        </div>
        <div style={{ marginBottom: '3px' }}>
          <span style={{ fontWeight: 'bold' }}>Teléfono:</span> {order.customer_phone}
        </div>
        {order.customer_email && (
          <div style={{ marginBottom: '3px' }}>
            <span style={{ fontWeight: 'bold' }}>Email:</span> {order.customer_email}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      {/* Datos del Dispositivo */}
      <div style={{ marginBottom: '10px', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>DATOS DEL EQUIPO</div>
        <div style={{ marginBottom: '3px' }}>
          <span style={{ fontWeight: 'bold' }}>Marca:</span> {order.device_brand}
        </div>
        <div style={{ marginBottom: '3px' }}>
          <span style={{ fontWeight: 'bold' }}>Modelo:</span> {order.device_model}
        </div>
        {order.device_imei && (
          <div style={{ marginBottom: '3px' }}>
            <span style={{ fontWeight: 'bold' }}>IMEI:</span> {order.device_imei}
          </div>
        )}
        {order.device_serial && (
          <div style={{ marginBottom: '3px' }}>
            <span style={{ fontWeight: 'bold' }}>Serial:</span> {order.device_serial}
          </div>
        )}
        {order.device_password && (
          <div style={{ marginBottom: '3px' }}>
            <span style={{ fontWeight: 'bold' }}>Contraseña:</span> {order.device_password}
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      {/* Problema Reportado */}
      <div style={{ marginBottom: '10px', fontSize: '11px' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>PROBLEMA REPORTADO</div>
        <div style={{ wordWrap: 'break-word' }}>{order.reported_problem}</div>
      </div>

      {/* Diagnóstico (solo si existe) */}
      {order.diagnosis && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
          <div style={{ marginBottom: '10px', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>DIAGNÓSTICO</div>
            <div style={{ wordWrap: 'break-word' }}>{order.diagnosis}</div>
          </div>
        </>
      )}

      {/* Detalles de Reparación (solo en entrega) */}
      {!isReception && order.repair_details && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
          <div style={{ marginBottom: '10px', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>TRABAJO REALIZADO</div>
            <div style={{ wordWrap: 'break-word' }}>{order.repair_details}</div>
          </div>
        </>
      )}

      {/* Información del Técnico */}
      {technician && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
          <div style={{ marginBottom: '10px', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>TÉCNICO ASIGNADO</div>
            <div style={{ marginBottom: '3px' }}>
              <span style={{ fontWeight: 'bold' }}>Nombre:</span> {technician.name}
            </div>
            {technician.phone && (
              <div style={{ marginBottom: '3px' }}>
                <span style={{ fontWeight: 'bold' }}>Teléfono:</span> {technician.phone}
              </div>
            )}
          </div>
        </>
      )}

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      {/* Precios */}
      <div style={{ marginBottom: '10px', fontSize: '11px' }}>
        {isReception ? (
          <>
            {order.estimated_price && order.estimated_price > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ fontWeight: 'bold' }}>Precio Estimado:</span>
                <span>COP {formatCOP(order.estimated_price)}</span>
              </div>
            )}
          </>
        ) : (
          <>
            {order.final_price && order.final_price > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '13px' }}>
                  <span style={{ fontWeight: 'bold' }}>TOTAL A PAGAR:</span>
                  <span style={{ fontWeight: 'bold' }}>COP {formatCOP(order.final_price)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                  <span>Abonado:</span>
                  <span>COP {formatCOP(order.paid_amount || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '13px' }}>
                  <span style={{ fontWeight: 'bold' }}>Saldo Pendiente:</span>
                  <span style={{ fontWeight: 'bold' }}>COP {formatCOP(order.final_price - (order.paid_amount || 0))}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Fechas estimadas */}
      {order.estimated_delivery_date && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
          <div style={{ marginBottom: '10px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ fontWeight: 'bold' }}>Fecha Estimada Entrega:</span>
              <span>{extractColombiaDateTime(order.estimated_delivery_date).split(' ')[0]}</span>
            </div>
          </div>
        </>
      )}

      {/* Observaciones */}
      {order.observations && (
        <>
          <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>
          <div style={{ marginBottom: '10px', fontSize: '11px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>OBSERVACIONES</div>
            <div style={{ wordWrap: 'break-word' }}>{order.observations}</div>
          </div>
        </>
      )}

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      {/* Seguimiento en línea */}
      <div style={{ marginBottom: '15px', fontSize: '10px', textAlign: 'center' }}>
        <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>
          SEGUIMIENTO EN LÍNEA
        </div>
        <div style={{ wordWrap: 'break-word' }}>
          {window.location.origin}/seguimiento/{order.tracking_code}
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '10px 0' }}></div>

      {/* Firma del Cliente */}
      <div style={{ marginTop: '20px', marginBottom: '10px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px', fontSize: '11px', fontWeight: 'bold' }}>
          {isReception ? 'FIRMA DEL CLIENTE (RECEPCIÓN)' : 'FIRMA DEL CLIENTE (ENTREGA)'}
        </div>
        <div style={{ borderTop: '1px solid #000', width: '70%', margin: '0 auto', paddingTop: '5px', textAlign: 'center', fontSize: '10px' }}>
          {order.customer_name}
        </div>
        <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '5px' }}>
          C.C./NIT: _____________________
        </div>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '15px 0' }}></div>

      {/* Condiciones */}
      <div style={{ fontSize: '8px', marginTop: '10px', textAlign: 'justify' }}>
        <div style={{ fontWeight: 'bold', marginBottom: '5px', textAlign: 'center' }}>TÉRMINOS Y CONDICIONES</div>
        <div style={{ marginBottom: '3px' }}>
          • El equipo se entrega tal como fue recibido si no se aprueba la reparación.
        </div>
        <div style={{ marginBottom: '3px' }}>
          • No nos hacemos responsables por información contenida en el dispositivo.
        </div>
        <div style={{ marginBottom: '3px' }}>
          • Respaldamos nuestro trabajo con garantía según el tipo de reparación.
        </div>
        <div style={{ marginBottom: '3px' }}>
          • El equipo se retendrá después de 30 días sin respuesta del cliente.
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: '15px', fontSize: '10px' }}>
        <div style={{ fontWeight: 'bold' }}>{companyName}</div>
        <div>Servicio Técnico Especializado</div>
        <div style={{ marginTop: '5px' }}>¡Gracias por confiar en nosotros!</div>
      </div>
    </div>
  );
}
