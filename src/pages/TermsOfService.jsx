import React from 'react';

const Section = ({ title, children }) => (
  <div className="legal-section">
    <h2>{title}</h2>
    {children}
  </div>
);

const TermsOfService = () => (
  <main className="legal-page">
    <div className="container">
      <div className="legal-header">
        <span className="section-label">Legal</span>
        <h1>Términos de Servicio</h1>
        <p>Última actualización: febrero de 2025</p>
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
            <li>Todos los precios están expresados en Pesos Colombianos (COP) e incluyen IVA cuando aplique.</li>
            <li>Los pagos en línea son procesados de forma segura a través de Mercado Pago.</li>
            <li>Los pedidos contraentrega se pagan en efectivo al momento de la entrega.</li>
            <li>Aurem Gs Joyería se reserva el derecho de corregir errores de precio antes de confirmar un pedido.</li>
          </ul>
        </Section>

        <Section title="4. Proceso de compra">
          <p>Un pedido se considera confirmado una vez que:</p>
          <ul>
            <li>El pago en línea es aprobado por Mercado Pago, o</li>
            <li>El pedido contraentrega es registrado y confirmado por nuestro equipo vía WhatsApp</li>
          </ul>
          <p>Nos reservamos el derecho de cancelar pedidos en caso de error en el precio, falta de inventario o sospecha de fraude.</p>
        </Section>

        <Section title="5. Envíos y entregas">
          <ul>
            <li>Realizamos envíos a todo Colombia.</li>
            <li>El pago contraentrega está disponible en las ciudades principales indicadas en nuestra tienda.</li>
            <li>Los tiempos de entrega son estimados y pueden variar según la ubicación y el transportador.</li>
            <li>Aurem Gs Joyería no se hace responsable por demoras causadas por terceros (transportadoras, fuerza mayor).</li>
          </ul>
        </Section>

        <Section title="6. Propiedad intelectual">
          <p>Todo el contenido de este sitio web — imágenes, textos, diseños y marca — es propiedad de Aurem Gs Joyería y está protegido por las leyes de propiedad intelectual. Queda prohibida su reproducción sin autorización expresa.</p>
        </Section>

        <Section title="7. Limitación de responsabilidad">
          <p>Aurem Gs Joyería no será responsable por daños indirectos, incidentales o consecuentes derivados del uso de nuestros productos o servicios, más allá de lo establecido por la ley colombiana de protección al consumidor.</p>
        </Section>

        <Section title="8. Ley aplicable">
          <p>Estos términos se rigen por las leyes de la República de Colombia. Cualquier disputa será resuelta ante los tribunales competentes del domicilio de Aurem Gs Joyería.</p>
        </Section>

        <Section title="9. Contacto">
          <p>Para cualquier pregunta sobre estos términos, contáctanos a través de nuestro WhatsApp o formulario de contacto disponible en el sitio.</p>
        </Section>
      </div>
    </div>
  </main>
);

export default TermsOfService;
