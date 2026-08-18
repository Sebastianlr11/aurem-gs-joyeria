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
        <p>Última actualización: agosto de 2026</p>
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
            <li>Datos de navegación en el sitio: páginas y piezas que visitas, y si completas una compra</li>
          </ul>
        </Section>

        <Section title="3. Finalidad del tratamiento">
          <p>Utilizamos tus datos para:</p>
          <ul>
            <li>Procesar y gestionar tus pedidos</li>
            <li>Coordinar entregas contraentrega</li>
            <li>Responder consultas y solicitudes de contacto</li>
            <li>Enviarte información sobre nuevas colecciones y ofertas (solo si das tu consentimiento)</li>
            <li>Medir el resultado de nuestra publicidad y mostrarte anuncios relevantes</li>
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
            <li><strong>Meta (Facebook e Instagram) y TikTok:</strong> para medir el resultado de nuestros anuncios. Ver la sección siguiente</li>
          </ul>
        </Section>

        <Section title="6. Cookies y píxeles de publicidad">
          <p>Este sitio usa los píxeles de Meta (Facebook e Instagram) y de TikTok. Son fragmentos de código que registran qué páginas y piezas visitas y si completas una compra, y le informan a esas plataformas el resultado de los anuncios por los que llegaste.</p>
          <p>Estos píxeles instalan cookies en tu navegador y reciben tu dirección IP, el navegador que usas y la página que estás viendo. Cuando compras, les enviamos además el valor del pedido y un identificador del pedido, para no contar la misma venta dos veces.</p>
          <p>No les enviamos tu nombre, tu dirección de entrega ni los datos de tu medio de pago.</p>
          <p>Podés impedirlo bloqueando las cookies de terceros en la configuración de tu navegador, o desde los ajustes de publicidad de tu cuenta de Facebook, Instagram o TikTok. El sitio sigue funcionando igual.</p>
        </Section>

        <Section title="7. Conservación de datos">
          <p>Conservamos tus datos durante el tiempo necesario para cumplir las finalidades descritas y las obligaciones legales aplicables en Colombia.</p>
        </Section>

        <Section title="8. Tus derechos">
          <p>De acuerdo con la Ley 1581 de 2012 (Ley de Protección de Datos Personales de Colombia), tienes derecho a:</p>
          <ul>
            <li>Conocer, actualizar y rectificar tus datos</li>
            <li>Solicitar la supresión de tus datos</li>
            <li>Revocar el consentimiento otorgado</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio</li>
          </ul>
          <p>Para ejercer estos derechos contáctanos a través de nuestro WhatsApp o formulario de contacto.</p>
        </Section>

        <Section title="9. Seguridad">
          <p>Implementamos medidas técnicas y organizativas para proteger tus datos personales contra acceso no autorizado, pérdida o alteración.</p>
        </Section>

        <Section title="10. Cambios a esta política">
          <p>Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios significativos publicando la nueva versión en esta página.</p>
        </Section>
      </div>
    </div>
  </main>
);

export default PrivacyPolicy;
