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
    const orderStatus = status === 'approved' ? 'pagado' : 'pendiente'

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

  const waContact = waUrl({ mobile: 'Hola! 🙏 Acabo de hacer un pedido en *Aurem Gs Joyería* y necesito ayuda con mi orden. Me pueden asistir?', desktop: 'Hola! Acabo de hacer un pedido en *Aurem Gs Joyería* y necesito ayuda con mi orden. Me pueden asistir?' })

  return (
    <div className="confirmacion-page">
      <div className={`confirmacion-card confirmacion--${isApproved ? 'success' : isPending ? 'pending' : 'failure'}`}>

        {/* Animated icon */}
        <div className="confirmacion-icon-wrap">
          {isApproved && (
            <svg className="confirmacion-icon confirmacion-icon--check" viewBox="0 0 52 52" fill="none">
              <circle className="confirmacion-circle" cx="26" cy="26" r="24" stroke="#22c55e" strokeWidth="2.5"/>
              <polyline className="confirmacion-check" points="14,27 22,35 38,17" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
          {isPending && (
            <svg className="confirmacion-icon" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="24" stroke="#f59e0b" strokeWidth="2.5"/>
              <line x1="26" y1="14" x2="26" y2="28" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round"/>
              <circle cx="26" cy="35" r="2" fill="#f59e0b"/>
            </svg>
          )}
          {isFailure && (
            <svg className="confirmacion-icon" viewBox="0 0 52 52" fill="none">
              <circle cx="26" cy="26" r="24" stroke="#ef4444" strokeWidth="2.5"/>
              <line x1="17" y1="17" x2="35" y2="35" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
              <line x1="35" y1="17" x2="17" y2="35" stroke="#ef4444" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          )}
        </div>

        <h1 className="confirmacion-status">
          {isApproved && '¡Tu pago fue confirmado! 🎉'}
          {isPending  && 'Pago en proceso...'}
          {isFailure  && 'Pago no completado'}
        </h1>

        <p className="confirmacion-message">
          {isApproved && 'Gracias por tu compra. Tu pedido ha sido registrado y nos pondremos en contacto contigo a la brevedad.'}
          {isPending  && 'Tu pago está siendo verificado por la entidad financiera. Te notificaremos en cuanto se confirme.'}
          {isFailure  && 'No pudimos procesar tu pago. Puedes intentarlo de nuevo o comunicarte con nosotros para ayudarte.'}
        </p>

        {(paymentId || externalRef) && (
          <div className="confirmacion-summary">
            {externalRef && (
              <div className="confirmacion-order-badge">
                <span className="confirmacion-order-label">Número de orden</span>
                <span className="confirmacion-order-number">{externalRef.slice(0, 8).toUpperCase()}</span>
              </div>
            )}
            {paymentId && (
              <div className="confirmacion-summary-row">
                <span>ID de pago</span>
                <span>{paymentId}</span>
              </div>
            )}
          </div>
        )}

        <div className="confirmacion-actions">
          <Link to="/catalogo" className="confirm-btn confirm-btn--primary">
            Ver más joyas
          </Link>
          {isFailure && (
            <Link to="/catalogo" className="confirm-btn confirmacion-btn--retry">
              Intentar de nuevo
            </Link>
          )}
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
