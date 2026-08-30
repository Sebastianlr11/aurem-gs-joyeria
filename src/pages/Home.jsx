import React from 'react';
import Hero from '../components/Hero';
import TrustBar from '../components/TrustBar';
import Collections from '../components/Collections';
import TiltedCarousel from '../components/TiltedCarousel';
import WhyUs from '../components/WhyUs';
import Reviews from '../components/Reviews';
import Faq from '../components/Faq';
import Contact from '../components/Contact';

const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JewelryStore',
    name: 'Aurem Gs Joyería',
    /* Con www, igual que la canónica de index.html. Sin él eran dos
       identidades para el mismo sitio a ojos de Google. */
    url: 'https://www.auremgsjoyeria.com',
    logo: 'https://www.auremgsjoyeria.com/assets/logo-isotipo.png',
    /* Esto es lo que Google lee del negocio, y prometía tres cosas que no son:
       platino —ni una pieza—, collares, pulseras y aretes —tampoco—, y
       "certificación de autenticidad" como si fuera incluida, cuando cuesta
       $50.000 aparte. Es la misma corrección que ya se hizo en la ficha, el
       catálogo y la pantalla de pago; el dato estructurado se había quedado
       atrás justo donde nadie lo mira. */
    description: 'Joyería en oro 18k y plata 925 con esmeralda colombiana natural. Anillos y dijes de catálogo, y piezas a medida hechas en nuestro taller. Envío a toda Colombia.',
    address: { '@type': 'PostalAddress', addressCountry: 'CO', addressLocality: 'Bogotá' },
    /* El WhatsApp, que es por donde entra todo. Va aquí porque es la pregunta
       que un asistente responde peor si no se la damos —«¿cómo contacto a
       Aurem Gs?»— y porque es el mismo número que ya está en el botón
       flotante y en la sección de contacto, no un dato nuevo. */
    telephone: '+573115761896',
    areaServed: { '@type': 'Country', name: 'Colombia' },
    priceRange: '$$',
    sameAs: ['https://www.instagram.com/auremgsjoyeria'],
};

const Home = () => {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
            {/* El <main> no es decorado: es el atajo con el que un lector de
                pantalla se salta el navbar y empieza a leer la página. Sin él
                —hasta el 30 de agosto de 2026— quien entra con NVDA o
                VoiceOver tenía que oírse el menú entero en cada carga.

                Las demás pantallas públicas ya lo tenían; la portada y la
                ficha, que son las dos que reciben el tráfico, no. */}
            <main>
                <Hero />
                <TrustBar />
                <Collections />
                <TiltedCarousel />
                <WhyUs />
                <Reviews />
                <Faq />
                <Contact />
            </main>
        </>
    );
};

export default Home;
