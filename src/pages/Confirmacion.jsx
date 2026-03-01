import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { waUrl } from '../lib/whatsapp'

const Confirmacion = () => {
  const [searchParams] = useSearchParams()
  const [updated, setUpdated] = useState(false)

  const paymentId       = searchParams.get('payment_id')
  const status          = searchParams.get('status')
  const externalRef     = searchParams.get('external_reference')

  useEffect(() => {
    if (!externalRef || !status || updated) return

    const mpStatus = status
    const orderStatus = status === 'approved' ? 'confirmado' : 'pendiente'

    supabase
      .from('orders')
      .update({
        mp_payment_id: paymentId,
        mp_status: mpStatus,
        status: orderStatus,
      })
      .eq('id', externalRef)
      .then(() => setUpdated(true))
  }, [externalRef, status, paymentId, updated])

  const isApproved  = status === 'approved'
  const isPending   = status === 'pending' || status === 'in_process'
  const isFailure   = !isApproved && !isPending

  const waContact = waUrl('Hola! Acabo de realizar un pedido en Aurem Gs Joyería y necesito ayuda. ¿Me pueden asistir? 🙏')

  return (
    <div className="confirm-page">
      <div className={`confirm-card confirm--${isApproved ? 'success' : isPending ? 'pending' : 'failure'}`}>

        <div className="confirm-icon">
          {isApproved && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="9 12 11.5 14.5 15 10"/>
            </svg>
          )}
          {isPending && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          )}
          {isFailure && (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          )}
        </div>

        <h1 className="confirm-title">
          {isApproved && '¡Pago aprobado!'}
          {isPending  && 'Pago en proceso'}
          {isFailure  && 'Pago no completado'}
        </h1>

        <p className="confirm-subtitle">
          {isApproved && 'Tu pedido ha sido confirmado. Nos pondremos en contacto contigo pronto.'}
          {isPending  && 'Tu pago está siendo procesado. Te notificaremos cuando se confirme.'}
          {isFailure  && 'No pudimos procesar tu pago. Puedes intentarlo de nuevo o contactarnos.'}
        </p>

        {(paymentId || externalRef) && (
          <div className="confirm-summary">
            {paymentId   && <div className="confirm-summary-row"><span>ID de pago</span><span>{paymentId}</span></div>}
            {externalRef && <div className="confirm-summary-row"><span>Orden</span><span>{externalRef.slice(0, 8)}…</span></div>}
          </div>
        )}

        <div className="confirm-actions">
          <Link to="/catalogo" className="confirm-btn confirm-btn--primary">
            Ver más joyas
          </Link>
          <a href={waContact} target="_blank" rel="noopener noreferrer" className="confirm-btn confirm-btn--wa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contactar
          </a>
        </div>
      </div>
    </div>
  )
}

export default Confirmacion
