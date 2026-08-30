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

const ReturnsPolicy = () => (
  <>
    <Meta
      titulo="Política de devoluciones | Aurem Gs Joyería"
      descripcion="Cuándo se puede devolver o cambiar una pieza, qué cubre la garantía del metal y cómo pedirlo."
      ruta="/politica-de-devoluciones"
    />
    <main className="legal-page">
    <div className="container">
      <div className="legal-header">
        <span className="section-label">Legal</span>
        <h1>Política de Devoluciones</h1>
        <p>Última actualización: agosto de 2026</p>
      </div>

      <div className="legal-body">
        <Section title="1. Derecho de retracto">
          <p>De acuerdo con el Estatuto del Consumidor colombiano (Ley 1480 de 2011), tienes derecho a retractarte de una compra realizada a distancia dentro de los <strong>5 días hábiles</strong> siguientes a la recepción del producto, sin necesidad de justificación.</p>
          <p>Para ejercer este derecho, el producto debe estar en perfectas condiciones, sin uso, con su empaque original y todos los accesorios incluidos.</p>
        </Section>

        <Section title="2. Condiciones para devolución">
          <p>Aceptamos devoluciones cuando:</p>
          <ul>
            <li>El producto llegó defectuoso o dañado</li>
            <li>El producto recibido no corresponde al pedido realizado</li>
            <li>Se ejerce el derecho de retracto dentro del plazo legal</li>
          </ul>
          <p><strong>No aceptamos devoluciones cuando:</strong></p>
          <ul>
            <li>El producto ha sido usado o alterado</li>
            <li>Se han retirado etiquetas o empaque original</li>
            <li>Han transcurrido más de 5 días hábiles desde la recepción</li>
            <li>El daño es causado por mal uso del cliente</li>
          </ul>
        </Section>

        <Section title="3. Proceso de devolución">
          <p>Para iniciar una devolución:</p>
          <ol>
            <li>Contáctanos por WhatsApp dentro del plazo indicado</li>
            <li>Describe el motivo de la devolución y adjunta fotos del producto</li>
            <li>Nuestro equipo evaluará tu caso y te confirmará la aprobación</li>
            <li>Te indicaremos cómo enviar el producto de vuelta</li>
            <li>Una vez recibido e inspeccionado, procesaremos el reembolso o cambio</li>
          </ol>
        </Section>

        <Section title="4. Reembolsos">
          <ul>
            <li><strong>Pagos con Mercado Pago:</strong> el reembolso se realiza al mismo método de pago utilizado, en un plazo de 5 a 10 días hábiles dependiendo del banco o entidad.</li>
            <li><strong>Pagos contraentrega:</strong> el reembolso se realiza mediante transferencia bancaria o Nequi/Daviplata en un plazo de 3 a 5 días hábiles tras aprobación.</li>
          </ul>
        </Section>

        {/* Decía sólo "30 días contra defectos de fabricación", y el sitio
            promete además una garantía de por vida en el metal —en la ficha de
            cada pieza, en el FAQ y en los Términos—. Esta pantalla es la que
            el cliente abre para reclamar, así que era justo la que se estaba
            quedando corta. Las dos garantías se separan como en los Términos:
            una responde por el material, la otra por el trabajo. */}
        <Section title="5. Garantías">
          <p>Tus piezas tienen dos garantías nuestras, que se suman a la garantía legal del Estatuto del Consumidor y nunca la reemplazan:</p>
          <ul>
            <li><strong>De por vida en el metal:</strong> que una pieza marcada como plata 925 sea plata 925, y que un oro 18k sea oro 18k. Los ajustes de talla y el pulido van sin costo.</li>
            <li><strong>30 días contra defectos de fabricación:</strong> engastes, soldaduras y acabados. Dentro de ese plazo reemplazamos o reparamos sin costo adicional.</li>
          </ul>
          <p>Las piedras no entran en ninguna de las dos. Si una se suelta o se daña, escríbenos y lo revisamos caso por caso.</p>
        </Section>

        <Section title="6. Gastos de envío en devoluciones">
          <ul>
            <li>Si la devolución se debe a un error nuestro (producto incorrecto o defectuoso), cubrimos el costo del envío de retorno.</li>
            <li>Si la devolución es por derecho de retracto, el costo del envío de retorno es responsabilidad del cliente.</li>
          </ul>
        </Section>

        <Section title="7. Contacto">
          <p>Para iniciar cualquier proceso de devolución o resolver dudas, comunícate con nosotros a través del WhatsApp o formulario de contacto disponible en la tienda.</p>
        </Section>
      </div>
    </div>
  </main>
  </>
);

export default ReturnsPolicy;
