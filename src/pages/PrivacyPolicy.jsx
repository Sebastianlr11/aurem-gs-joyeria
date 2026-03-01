import React from 'react';

const Section = ({ title, children }) => (
  <div className="legal-section">
    <h2>{title}</h2>
    {children}
  </div>
);

const PrivacyPolicy = () => (
  <main className="legal-page">
    <div className="container">
      <div className="legal-header">
        <span className="section-label">Legal</span>
        <h1>Política de Privacidad</h1>
        <p>Última actualización: febrero de 2025</p>
      </div>

      <div className="legal-body">
        <Section title="1. Responsable del tratamiento">
          <p>Aurem Gs Joyería, con domicilio en Colombia, es responsable del tratamiento de los datos personales que nos proporciones a través de este sitio web y sus canales de atención.</p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <p>Podemos recopilar la siguiente información personal:</p>
          <ul>
            <li>Nombre completo</li>
            <li>Correo electrónico</li>
            <li>Número de teléfono</li>
            <li>Ciudad y dirección de entrega</li>
            <li>Información de pago (procesada de forma segura por Mercado Pago, sin acceso directo por nuestra parte)</li>
          </ul>
        </Section>

        <Section title="3. Finalidad del tratamiento">
          <p>Utilizamos tus datos para:</p>
          <ul>
            <li>Procesar y gestionar tus pedidos</li>
            <li>Coordinar entregas contraentrega</li>
            <li>Responder consultas y solicitudes de contacto</li>
            <li>Enviarte información sobre nuevas colecciones y ofertas (solo si das tu consentimiento)</li>
            <li>Cumplir obligaciones legales y fiscales</li>
          </ul>
        </Section>

        <Section title="4. Base legal">
          <p>El tratamiento de tus datos se basa en el consentimiento que otorgas al completar nuestros formularios, y en la ejecución del contrato de compraventa cuando realizas un pedido.</p>
        </Section>

        <Section title="5. Compartir datos con terceros">
          <p>No vendemos ni cedemos tus datos personales a terceros con fines comerciales. Podemos compartir información estrictamente necesaria con:</p>
          <ul>
            <li><strong>Mercado Pago:</strong> para procesar pagos en línea</li>
            <li><strong>Empresas de mensajería:</strong> para coordinar la entrega de tus pedidos</li>
          </ul>
        </Section>

        <Section title="6. Conservación de datos">
          <p>Conservamos tus datos durante el tiempo necesario para cumplir las finalidades descritas y las obligaciones legales aplicables en Colombia.</p>
        </Section>

        <Section title="7. Tus derechos">
          <p>De acuerdo con la Ley 1581 de 2012 (Ley de Protección de Datos Personales de Colombia), tienes derecho a:</p>
          <ul>
            <li>Conocer, actualizar y rectificar tus datos</li>
            <li>Solicitar la supresión de tus datos</li>
            <li>Revocar el consentimiento otorgado</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio</li>
          </ul>
          <p>Para ejercer estos derechos contáctanos a través de nuestro WhatsApp o formulario de contacto.</p>
        </Section>

        <Section title="8. Seguridad">
          <p>Implementamos medidas técnicas y organizativas para proteger tus datos personales contra acceso no autorizado, pérdida o alteración.</p>
        </Section>

        <Section title="9. Cambios a esta política">
          <p>Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios significativos publicando la nueva versión en esta página.</p>
        </Section>
      </div>
    </div>
  </main>
);

export default PrivacyPolicy;
