import React from 'react';
import Meta from '../components/Meta';

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

const PrivacyPolicy = () => (
  <>
    <Meta
      titulo="Política de privacidad | Aurem Gs Joyería"
      descripcion="Qué datos pedimos, para qué los usamos y cómo pedir que los borremos. Joyería Aurem Gs, Bogotá."
      ruta="/politica-de-privacidad"
    />
    <main className="legal-page">
    <div className="container">
      <div className="legal-header">
        <span className="section-label">Legal</span>
        <h1>Política de Privacidad</h1>
        <p>Última actualización: agosto de 2026</p>
      </div>

      <div className="legal-body">
        <Section title="1. Responsable del tratamiento">
          <p>Aurem Gs Joyería, con domicilio en Bogotá, Colombia, es responsable del tratamiento de los datos personales que nos proporciones a través de este sitio web y de nuestros canales de atención, incluido WhatsApp.</p>
          <p>Para cualquier asunto relacionado con tus datos: <a href="mailto:hola@auremgsjoyeria.com">hola@auremgsjoyeria.com</a>.</p>
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
            <li>El contenido de tus conversaciones con nosotros por WhatsApp, incluidas las fotos y las notas de voz que nos envías</li>
            <li>La talla de anillo, cuando nos la das o la calculamos con la medida que nos compartes</li>
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
            <li><strong>Meta (Facebook e Instagram) y TikTok:</strong> para medir el resultado de nuestros anuncios. Ver la sección 6</li>
            <li><strong>Proveedores de inteligencia artificial:</strong> para que nuestra asistente pueda leer, escuchar y responder tus mensajes de WhatsApp. Ver la sección 7</li>
            <li><strong>Proveedores de infraestructura:</strong> Supabase, donde se guardan los datos; Vercel, donde funciona el sitio; y Resend, que envía nuestros correos</li>
          </ul>

          <p>Estos proveedores tienen servidores fuera de Colombia, principalmente en Estados Unidos, de modo que tus datos son objeto de <strong>transferencia internacional</strong>. Al usar nuestros servicios y aceptar esta política, autorizas esa transferencia. Sólo trabajamos con proveedores que se comprometen contractualmente a tratar los datos únicamente para prestarnos el servicio.</p>
        </Section>

        <Section title="6. Cookies y píxeles de publicidad">
          <p>Este sitio usa los píxeles de Meta (Facebook e Instagram) y de TikTok. Son fragmentos de código que registran qué páginas y piezas visitas y si completas una compra, y le informan a esas plataformas el resultado de los anuncios por los que llegaste.</p>
          <p>Estos píxeles instalan cookies en tu navegador y reciben tu dirección IP, el navegador que usas y la página que estás viendo. Cuando compras, les enviamos además el valor del pedido y un identificador del pedido, para no contar la misma venta dos veces.</p>
          <p>Cuando compras les enviamos además tu correo y tu teléfono <strong>cifrados con SHA-256</strong>, un procedimiento que convierte cada dato en una cadena irreversible. Sirve para que la plataforma reconozca que la venta viene de un anuncio suyo sin que nosotros le revelemos quién eres, y ni Meta ni TikTok pueden recuperar el dato original a partir de ella.</p>
          <p>No les enviamos tu nombre, tu dirección de entrega, el contenido de tus conversaciones ni los datos de tu medio de pago.</p>
          <p>Podés impedirlo bloqueando las cookies de terceros en la configuración de tu navegador, o desde los ajustes de publicidad de tu cuenta de Facebook, Instagram o TikTok. El sitio sigue funcionando igual.</p>
        </Section>

        <Section title="7. Nuestra asistente por WhatsApp">
          <p>Cuando nos escribes por WhatsApp te atiende <strong>Valentina, una asistente automática</strong>, no una persona. Si en algún momento prefieres hablar con alguien del equipo, pídelo y te pasamos con una persona.</p>
          <p>Para poder responderte, el contenido de tus mensajes se envía a proveedores de inteligencia artificial que lo interpretan:</p>
          <ul>
            <li><strong>El texto</strong> de la conversación, para entender qué necesitas y responderte</li>
            <li><strong>Las notas de voz</strong>, que se transcriben a texto</li>
            <li><strong>Las fotos</strong> que envías, que se describen para poder hablar de ellas y cotizarlas</li>
          </ul>
          <p>Esos proveedores procesan el contenido para prestarnos el servicio y no lo usan para entrenar sus modelos.</p>
          <p>Guardamos el historial de la conversación —incluidas las fotos y la transcripción de las notas de voz— para poder atender tu pedido, resolver reclamos y dar continuidad si vuelves a escribirnos. Las fotos se almacenan de forma privada: sólo pueden verlas las personas del equipo con acceso al panel de atención.</p>
          <p>Si prefieres que no se conserve tu conversación, escríbenos a <a href="mailto:hola@auremgsjoyeria.com">hola@auremgsjoyeria.com</a> y la eliminamos, salvo lo que debamos conservar por obligación legal o para atender un pedido en curso.</p>
        </Section>

        <Section title="8. Conservación de datos">
          <p>Conservamos los datos de tus pedidos mientras duren las obligaciones contables y fiscales que nos exige la ley colombiana. Las conversaciones y las fotos se conservan mientras sigas siendo cliente y durante el tiempo en que puedas presentar un reclamo o hacer valer la garantía.</p>
          <p>Pasado ese tiempo, o si nos lo pides antes, los eliminamos.</p>
        </Section>

        <Section title="9. Tus derechos">
          <p>De acuerdo con la Ley 1581 de 2012 (Ley de Protección de Datos Personales de Colombia), tienes derecho a:</p>
          <ul>
            <li>Conocer, actualizar y rectificar tus datos</li>
            <li>Solicitar la supresión de tus datos</li>
            <li>Revocar el consentimiento otorgado</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio</li>
          </ul>
          <p>Para ejercer cualquiera de estos derechos escríbenos a <a href="mailto:hola@auremgsjoyeria.com">hola@auremgsjoyeria.com</a> indicando tu nombre y qué solicitas. Respondemos en un plazo máximo de quince días hábiles, como establece la ley.</p>
          <p>Si consideras que no atendimos tu solicitud como corresponde, puedes acudir a la Superintendencia de Industria y Comercio.</p>
        </Section>

        <Section title="10. Seguridad">
          <p>Implementamos medidas técnicas y organizativas para proteger tus datos personales contra acceso no autorizado, pérdida o alteración.</p>
        </Section>

        <Section title="11. Cambios a esta política">
          <p>Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios significativos publicando la nueva versión en esta página.</p>
        </Section>
      </div>
    </div>
  </main>
  </>
);

export default PrivacyPolicy;
