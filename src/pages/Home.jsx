import React from 'react';
import Hero from '../components/Hero';
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
    url: 'https://auremgsjoyeria.com',
    logo: 'https://auremgsjoyeria.com/assets/logo1.png',
    description: 'Joyería de lujo en oro 18k, plata 925 y platino. Anillos, collares, pulseras y aretes con certificación de autenticidad. Envío a toda Colombia.',
    address: { '@type': 'PostalAddress', addressCountry: 'CO' },
    priceRange: '$$',
    sameAs: ['https://www.instagram.com/auremgsjoyeria'],
};

const Home = () => {
    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
            <Hero />
            <Collections />
            <TiltedCarousel />
            <WhyUs />
            <Reviews />
            <Faq />
            <Contact />
        </>
    );
};

export default Home;
