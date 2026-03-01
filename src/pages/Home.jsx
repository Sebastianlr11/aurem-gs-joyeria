import React from 'react';
import Hero from '../components/Hero';
import Collections from '../components/Collections';
import TiltedCarousel from '../components/TiltedCarousel';
import WhyUs from '../components/WhyUs';
import Reviews from '../components/Reviews';
import Faq from '../components/Faq';
import Contact from '../components/Contact';

const Home = () => {
    return (
        <>
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
