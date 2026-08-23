import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { waUrl } from '../lib/whatsapp'
import { pixelCompra } from '../lib/pixeles'

const enPesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`

/* Fuera del componente a propósito. Definida dentro, React la trataba como un
   componente NUEVO en cada render: desmontaba y volvía a montar cada fila en
   vez de actualizarla. Sólo usa sus props, así que no había motivo para que
   viviera ahí. */
const Fila = ({ etiqueta, children }) => (
  <div className="conf-fila">
    <span>{etiqueta}</span>
    <span>{children}</span>
  </div>
)

const Confirmacion = () => {
  const [searchParams] = useSearchParams()
  const [pedido, setPedido] = useState(null)
  const [copiado, setCopiado] = useState(false)
  /* Un ref y no estado: esto no se pinta, sólo impide que el píxel cuente la
     misma compra dos veces si la pantalla se vuelve a renderizar. Como estado
     obligaba a un setState dentro del efecto —y a un render de más— para algo
     que nadie ve. */
  const medido = useRef(false)

  const paymentId   = searchParams.get('payment_id')
  const status      = searchParams.get('status')
  const externalRef = searchParams.get('external_reference')

  const aprobado = status === 'approved'
  const enProceso = status === 'pending' || status === 'in_process'
  const fallido = !aprobado && !enProceso

  /* Esta pantalla sólo lee. Antes escribía el estado del pedido —marcaba
     "pagado" si la URL decía approved— y eso estaba mal por dos motivos.

     El primero es el dinero: en un contraentrega sólo entra el abono, y
     marcar "pagado" daba por cobrado el total. Medio millón que sigue en la
     puerta del cliente, contado como si estuviera en la cuenta.

     El segundo es que corre en el navegador con la llave pública: quien
     abriera /confirmacion?external_reference=<pedido>&status=approved dejaba
     un pedido por pagado sin haber pagado.

     Quien decide el estado es el webhook, que le pregunta el pago a Mercado
     Pago con el token del servidor y sabe distinguir un abono de un total. */
  /* Por una función y no leyendo `orders` de frente: esta pantalla corre con
     la llave pública, y `anon` no tiene —ni debe tener— permiso de lectura
     sobre la tabla de pedidos, que guarda nombre, teléfono, correo y
     dirección de todo el mundo.

     Leyendo la tabla, esto devolvía null para cualquiera que no fuera del
     equipo: la clienta no veía el resumen de su pedido y, peor, pixelCompra()
     de más abajo está condicionado a que el pedido exista, así que el evento
     Purchase del navegador no se disparaba nunca. Sólo salía el del servidor,
     y la deduplicación entre los dos embudos se quedaba coja.

     `pedido_publico` devuelve las cinco columnas que se usan aquí y ninguna
     más. El id es un uuid v4 y llega en la URL de vuelta de Mercado Pago. */
  useEffect(() => {
    if (!externalRef) return
    supabase
      .rpc('pedido_publico', { p_id: externalRef })
      .maybeSingle()
      .then(({ data }) => setPedido(data ?? null))
  }, [externalRef])

  /* El píxel del navegador, con el mismo event_id que manda el servidor: las
     dos plataformas los juntan y cuentan una sola venta. El valor sale de la
     base y no de la URL, que la puede cambiar cualquiera. */
  useEffect(() => {
    if (!aprobado || !externalRef || !pedido || medido.current) return
    medido.current = true
    pixelCompra({
      pedidoId: externalRef,
      valor: pedido.amount,
      piezaId: pedido.product_id,
      piezaNombre: pedido.product_name,
    })
  }, [aprobado, externalRef, pedido])

  const numero = externalRef ? externalRef.slice(0, 8).toUpperCase() : null

  const copiar = () => {
    if (!numero) return
    navigator.clipboard?.writeText(numero).catch(() => {})
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2400)
  }

  /* Un contraentrega no se paga entero acá: entra el abono y el resto va en
     efectivo en la puerta. Decirle "pago recibido" a secas y callarse el
     saldo es la sorpresa que hace que rechacen la entrega. */
  const esAbono = pedido?.abono_monto != null
  const saldo = esAbono ? Number(pedido.amount) - Number(pedido.abono_monto) : 0

  const waContacto = waUrl({
    mobile: `Hola! 🙏 Acabo de hacer un pedido en *Aurem Gs Joyería*${numero ? ` (orden ${numero})` : ''} y necesito ayuda. Me pueden asistir?`,
    desktop: `Hola! Acabo de hacer un pedido en *Aurem Gs Joyería*${numero ? ` (orden ${numero})` : ''} y necesito ayuda. Me pueden asistir?`,
  })

  return (
    <main className="conf">
      <div className="conf-caja">

        <header className="conf-cabeza">
          <span className="conf-marca" aria-hidden="true">
            {aprobado && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
              </svg>
            )}
            {enProceso && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
              </svg>
            )}
            {fallido && (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </span>

          <span className="eyebrow">
            {aprobado ? (esAbono ? 'Pedido confirmado' : 'Pago confirmado')
              : enProceso ? 'Pago en verificación' : 'Pago no aprobado'}
          </span>

          <h1 className="conf-titulo">
            {aprobado && <>Pago recibido,<em>empezamos tu pieza.</em></>}
            {enProceso && <>Estamos verificando,<em>no cierres esta página.</em></>}
            {fallido && <>El pago no pasó,<em>tu pedido sigue aquí.</em></>}
          </h1>

          <p className="conf-lead">
            {aprobado && (esAbono
              ? `Recibimos tu abono. Al recibir la pieza pagas ${enPesos(saldo)} en efectivo. Te escribimos por WhatsApp con la guía de envío.`
              : 'Tu pieza se hace por encargo: el taller se toma 2 a 3 días y te escribimos por WhatsApp con la guía. La tienes en 3 a 4 días en Bogotá y en 4 a 6 en el resto del país.')}
            {enProceso && 'El banco todavía está verificando el pago. En cuanto se confirme te escribimos por WhatsApp; no hace falta que pagues otra vez.'}
            {fallido && 'No se hizo ningún cargo a tu tarjeta. Tu pedido sigue guardado: puedes intentar de nuevo o escribirnos y lo resolvemos.'}
          </p>

          {/* Sólo lo comprobable. El certificado no va aquí: cuesta $50.000
              aparte y prometerlo en la pantalla del pago es exactamente el
              cobro sorpresa que evitamos en toda la ficha. */}
          <div className="conf-punzones">
            {aprobado && <>
              <span className="punzon">Estuche incluido</span>
              <span className="punzon">Garantía de por vida en el metal</span>
            </>}
            {fallido && <>
              <span className="punzon">Sin cargo</span>
              <span className="punzon">Tu pedido sigue guardado</span>
            </>}
          </div>
        </header>

        {(numero || pedido) && (
          <section className="conf-resumen">
            {numero && aprobado && (
              <div className="conf-numero">
                <span className="conf-numero-label">Número de orden</span>
                <span className="conf-numero-valor">{numero}</span>
                <button type="button" onClick={copiar} className="conf-copiar">
                  {copiado ? 'Copiado' : 'Copiar número'}
                </button>
              </div>
            )}

            {pedido?.product_name && <Fila etiqueta="Pieza">{pedido.product_name}</Fila>}
            {numero && !aprobado && <Fila etiqueta="Referencia">{numero}</Fila>}
            {pedido?.payment_method && (
              <Fila etiqueta="Forma de pago">
                {pedido.payment_method === 'contraentrega' ? 'Contraentrega en Bogotá' : 'Mercado Pago'}
              </Fila>
            )}
            {paymentId && aprobado && <Fila etiqueta="ID de pago">{paymentId}</Fila>}

            {esAbono ? (
              <>
                <Fila etiqueta="Abonaste">{enPesos(pedido.abono_monto)} <small>COP</small></Fila>
                <Fila etiqueta="Pagas al recibir"><strong>{enPesos(saldo)}</strong> <small>COP</small></Fila>
              </>
            ) : pedido?.amount != null && (
              <Fila etiqueta="Total">{enPesos(pedido.amount)} <small>COP</small></Fila>
            )}
          </section>
        )}

        {aprobado && (
          <section className="conf-pasos">
            <span className="eyebrow">Qué sigue</span>
            <div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
              </svg>
              <p><strong>Hoy.</strong> Te confirmamos el pedido por WhatsApp y verificamos la talla.</p>
            </div>
            <div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 3h14v13H5z" /><path d="M8.5 19.5 12 17l3.5 2.5V16h-7z" /><path d="M8.5 7.5h7M8.5 11h4" />
              </svg>
              <p><strong>Antes de enviar.</strong> Revisamos la pieza, la pulimos y la empacamos en su estuche.</p>
            </div>
            <div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="3" width="15" height="13" /><path d="M16 8h4l3 3v5h-7z" />
                <circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
              </svg>
              <p><strong>3 a 4 días en Bogotá.</strong> Al resto del país, de 4 a 6. Se hace por encargo y sale con número de guía.</p>
            </div>
          </section>
        )}

        <div className="conf-acciones">
          <Link to={fallido ? '/catalogo' : '/catalogo'} className="btn-pill black">
            {fallido ? 'Intentar de nuevo' : 'Ver el catálogo'}
          </Link>
          <a href={waContacto} target="_blank" rel="noopener noreferrer" className="btn-pill light conf-wa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#25D366" aria-hidden="true">
              <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.01-1.04 2.47 0 1.46 1.06 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.42-.07-.13-.27-.2-.57-.35M12.05 21.5a9.5 9.5 0 0 1-4.84-1.32l-.35-.2-3.59.94.96-3.5-.23-.36a9.44 9.44 0 0 1-1.45-5.05c0-5.23 4.27-9.49 9.51-9.49 2.54 0 4.92.99 6.72 2.78a9.42 9.42 0 0 1 2.78 6.72c0 5.23-4.27 9.49-9.51 9.49M20.5 3.49A11.4 11.4 0 0 0 12.05 0C5.77 0 .66 5.1.66 11.37c0 2 .52 3.96 1.52 5.68L.56 24l7.1-1.86a11.4 11.4 0 0 0 5.44 1.38c6.28 0 11.39-5.1 11.39-11.37 0-3.04-1.19-5.9-3.34-8.05" />
            </svg>
            Escríbenos por WhatsApp
          </a>
        </div>

        {/* La salida para quien no pudo pagar en línea. Sólo Bogotá: ofrecerla
            a todo el país sería prometer algo que el taller no hace. */}
        {fallido && (
          <div className="conf-cod">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--oro)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="6" width="20" height="12" rx="1.5" /><circle cx="12" cy="12" r="2.8" />
              <path d="M5 9.5v5M19 9.5v5" />
            </svg>
            <p>
              <strong>¿Estás en Bogotá?</strong> Puedes pagar contra entrega: abonas el envío
              para confirmar el pedido y el resto lo pagas en efectivo cuando te lo lleven.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

export default Confirmacion
