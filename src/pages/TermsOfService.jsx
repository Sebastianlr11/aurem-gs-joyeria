import React from 'react';
import Meta from '../components/Meta';
import { Link } from 'react-router-dom';

/* Su propia hoja, y no `index.css`.

   `index.css` bloquea el primer pintado en todas las rutas, así que cada
   regla que vive ahí la paga también quien sólo abre la portada. Esta página
   ya se carga aparte —va perezosa en `App.jsx`— y desde el 30 de agosto de
   2026 se trae su CSS con ella. Se carga después de `index.css`: a igual
   especificidad, gana lo de aquí. */
import './legales.css'

const Section = ({ title, children }) => (
  <div className="legal-section">
    <h2>{title}</h2>
    {children}
  </div>
);

const TermsOfService = () => (
  <>
    <Meta
      titulo="Términos de servicio | Aurem Gs Joyería"
      descripcion="Condiciones de compra, formas de pago, plazos de entrega y garantía de las piezas de Aurem Gs Joyería."
      ruta="/terminos-de-servicio"
    />
    <main className="legal-page">
    <div className="container">
      <div className="legal-header">
        <span className="section-label">Legal</span>
        <h1>Términos de Servicio</h1>
        <p>Última actualización: agosto de 2026</p>
      </div>

      <div className="legal-body">
        <Section title="1. Aceptación de los términos">
          <p>Al acceder y utilizar el sitio web de Aurem Gs Joyería y realizar compras a través de él, aceptas estos Términos de Servicio en su totalidad. Si no estás de acuerdo, te pedimos que no utilices nuestros servicios.</p>
        </Section>

        <Section title="2. Productos y disponibilidad">
          <p>Todos nuestros productos son piezas artesanales de joyería. Nos reservamos el derecho de modificar, descontinuar o limitar la disponibilidad de cualquier producto sin previo aviso. Las imágenes son referenciales y pueden presentar ligeras variaciones con respecto al producto físico debido a la naturaleza artesanal de cada pieza.</p>
        </Section>

        <Section title="3. Precios y pagos">
          <ul>
            <li>Todos los precios están expresados en Pesos Colombianos (COP). El precio que ves es el precio final: no se suman cargos al confirmar.</li>
            <li>Los pagos en línea se procesan a través de Mercado Pago, que acepta tarjeta, PSE y Nequi. Nosotros no vemos ni almacenamos los datos de tu medio de pago.</li>
            <li>Aurem Gs Joyería se reserva el derecho de corregir errores de precio antes de confirmar un pedido.</li>
          </ul>

          <h3>Contraentrega</h3>
          <ul>
            <li><strong>Sólo en Bogotá.</strong> Al resto del país se despacha con el pago hecho por adelantado.</li>
            <li><strong>Sólo hasta $500.000.</strong> Por encima de ese monto la pieza se paga en línea antes de despacharse.</li>
            <li><strong>Pide un abono de $20.000</strong>, que es el valor del envío y se paga en línea al hacer el pedido. Ese abono <strong>se descuenta del total</strong>: al recibir la pieza pagas en efectivo únicamente el saldo. No es un cobro adicional.</li>
            <li>El abono existe porque la transportadora cobra el envío aunque el pedido se rechace en la puerta. Si el pedido se cancela por causa nuestra, el abono se devuelve completo.</li>
          </ul>
        </Section>

        <Section title="4. Proceso de compra">
          <p>Un pedido se considera confirmado una vez que:</p>
          <ul>
            <li><strong>Pago en línea:</strong> Mercado Pago aprueba el pago del total.</li>
            <li><strong>Contraentrega:</strong> Mercado Pago aprueba el abono del envío. Hasta ese momento el pedido no entra a producción ni se despacha.</li>
          </ul>
          <p>En ambos casos recibes la confirmación por WhatsApp y, si nos diste tu correo, también por correo electrónico.</p>
          <p>Nos reservamos el derecho de cancelar pedidos en caso de error en el precio, falta de inventario o sospecha de fraude.</p>
        </Section>

        <Section title="5. Envíos y entregas">
          <ul>
            <li>Realizamos envíos a todo Colombia.</li>
            <li>En Bogotá la entrega toma entre 24 y 48 horas. Al resto del país, entre 2 y 3 días.</li>
            <li>Esos tiempos son estimados y corren desde el despacho, no desde el pedido. Pueden variar según la ubicación y la transportadora.</li>
            <li>Te enviamos el número de guía al despachar, para que puedas seguir el envío.</li>
            <li>Aurem Gs Joyería no se hace responsable por demoras causadas por terceros (transportadoras, fuerza mayor).</li>
          </ul>
        </Section>

        <Section title="6. Garantías">
          <p>Tus piezas tienen dos garantías nuestras, que se suman a la garantía legal del Estatuto del Consumidor y nunca la reemplazan:</p>
          <ul>
            <li><strong>De por vida en el metal:</strong> que una pieza marcada como plata 925 sea plata 925, y que un oro 18k sea oro 18k.</li>
            <li><strong>30 días en defectos de fabricación:</strong> engastes, soldaduras y acabados.</li>
          </ul>
          <p>El detalle está en nuestra <Link to="/politica-de-devoluciones">Política de Devoluciones</Link>.</p>
        </Section>

        <Section title="7. Retracto y reversión del pago">
          <p>Tienes derecho a retractarte dentro de los <strong>5 días hábiles</strong> siguientes a recibir tu pedido, según el artículo 47 de la Ley 1480 de 2011. Las condiciones están en la <Link to="/politica-de-devoluciones">Política de Devoluciones</Link>.</p>
          <p>Cuando pagas con tarjeta y la compra no se concreta —el producto no se entrega, no corresponde a lo pedido, o es defectuoso— puedes solicitar la <strong>reversión del pago</strong> conforme al artículo 51 de la misma ley. Escríbenos y tramitamos la solicitud ante Mercado Pago y la entidad emisora.</p>
        </Section>

        <Section title="8. Propiedad intelectual">
          <p>Todo el contenido de este sitio web — imágenes, textos, diseños y marca — es propiedad de Aurem Gs Joyería y está protegido por las leyes de propiedad intelectual. Queda prohibida su reproducción sin autorización expresa.</p>
        </Section>

        <Section title="9. Limitación de responsabilidad">
          <p>Aurem Gs Joyería no será responsable por daños indirectos, incidentales o consecuentes derivados del uso de nuestros productos o servicios, más allá de lo establecido por la ley colombiana de protección al consumidor.</p>
        </Section>

        <Section title="10. Ley aplicable">
          <p>Estos términos se rigen por las leyes de la República de Colombia. Cualquier disputa será resuelta ante los tribunales competentes del domicilio de Aurem Gs Joyería.</p>
        </Section>

        <Section title="11. Contacto">
          <p>Para cualquier pregunta sobre estos términos, escríbenos por WhatsApp o a <a href="mailto:hola@auremgsjoyeria.com">hola@auremgsjoyeria.com</a>.</p>
        </Section>
      </div>
    </div>
  </main>
  </>
);

export default TermsOfService;
