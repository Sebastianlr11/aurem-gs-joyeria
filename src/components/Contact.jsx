import React, { useState } from 'react';
import { WA_NUMBER, waUrl } from '../lib/whatsapp';
import { motion } from 'framer-motion';

const fadeUp = {
    hidden: { opacity: 0, y: 30 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } }
};

const MailIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
    </svg>
);

const WhatsAppIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
    </svg>
);

const EMAIL = 'hola@auremgsjoyeria.com';

const interestOptions = ['Joya del Catálogo', 'Pieza Personalizada'];

const Contact = () => {
    const [interest, setInterest] = useState('Joya del Catálogo');
    const [form, setForm]         = useState({ name: '', email: '', phone: '', message: '' });
    const [copied, setCopied]     = useState(false);
    const [errors, setErrors]     = useState({});
    const [sent, setSent]         = useState(false);

    const handleCopyEmail = () => {
        navigator.clipboard.writeText(EMAIL);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        if (errors[e.target.name]) setErrors(err => { const n = { ...err }; delete n[e.target.name]; return n; });
    };

    const validate = () => {
        const e = {};
        if (!form.name.trim()) e.name = 'Ingresa tu nombre';
        if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Ingresa un email válido';
        return e;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const e2 = validate();
        if (Object.keys(e2).length) { setErrors(e2); return; }

        const lines = [
            `Hola! Me comunico desde el formulario de contacto de Aurem Gs Joyeria. 💎`,
            ``,
            `👤 Nombre: ${form.name.trim()}`,
            `📧 Correo: ${form.email.trim()}`,
            form.phone.trim() ? `📞 Telefono: ${form.phone.trim()}` : null,
            `💡 Interes: ${interest}`,
            form.message.trim() ? `💬 Mensaje: ${form.message.trim()}` : null,
        ].filter(Boolean).join('\n');

        window.open(waUrl(lines), '_blank');
        setSent(true);
        setForm({ name: '', email: '', phone: '', message: '' });
        setTimeout(() => setSent(false), 5000);
    };

    return (
        <section id="contacto" className="contact-section">
            <div className="container">
                <div className="contact-layout">

                    {/* Left */}
                    <motion.div
                        className="contact-left"
                        initial={{ opacity: 0, x: -40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        viewport={{ once: true, margin: '-80px' }}
                    >
                        <div className="contact-badge">
                            <span>//</span> Contacto <span>//</span>
                        </div>
                        <h2 className="contact-title">Hablemos.</h2>
                        <p className="contact-subtitle">
                            ¿Tienes preguntas o lista para elegir tu pieza perfecta? Escríbenos y te respondemos en menos de 24 horas.
                        </p>

                        {/* Contact cards */}
                        <div className="contact-cards" style={{ position: 'relative' }}>
                            {/* Email card */}
                            <button className="contact-card contact-card--btn" onClick={handleCopyEmail} title="Copiar correo">
                                <div className="contact-card-top">
                                    <div className="contact-card-icon"><MailIcon /></div>
                                    <div className="contact-card-dots">
                                        <span></span><span></span>
                                    </div>
                                </div>
                                <p className="contact-card-label">/ Escríbenos</p>
                                <p className="contact-card-value">{EMAIL}</p>
                            </button>

                            {/* WhatsApp card */}
                            <a
                                href={`https://wa.me/${WA_NUMBER}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="contact-card contact-card--btn"
                            >
                                <div className="contact-card-top">
                                    <div className="contact-card-icon"><WhatsAppIcon /></div>
                                    <div className="contact-card-dots">
                                        <span></span><span></span>
                                    </div>
                                </div>
                                <p className="contact-card-label">/ WhatsApp</p>
                                <p className="contact-card-value">+57 314 360 2930</p>
                            </a>

                            {/* Toast copiado */}
                            {copied && (
                                <div className="contact-copied-toast">
                                    ✓ Correo copiado
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Right — form */}
                    <motion.form
                        className="contact-form"
                        onSubmit={handleSubmit}
                        initial={{ opacity: 0, x: 40 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
                        viewport={{ once: true, margin: '-80px' }}
                    >

                        <div className="contact-field">
                            <label className="contact-label">Tu nombre *</label>
                            <input
                                className={`contact-input${errors.name ? ' contact-input--error' : ''}`}
                                type="text"
                                name="name"
                                placeholder="Tu nombre completo"
                                value={form.name}
                                onChange={handleChange}
                            />
                            {errors.name && <span className="contact-field-error">{errors.name}</span>}
                        </div>

                        <div className="contact-field">
                            <label className="contact-label">Correo electrónico *</label>
                            <input
                                className={`contact-input${errors.email ? ' contact-input--error' : ''}`}
                                type="email"
                                name="email"
                                placeholder="tu@correo.com"
                                value={form.email}
                                onChange={handleChange}
                            />
                            {errors.email && <span className="contact-field-error">{errors.email}</span>}
                        </div>

                        <div className="contact-field">
                            <label className="contact-label">Teléfono</label>
                            <input
                                className="contact-input"
                                type="tel"
                                name="phone"
                                placeholder="+1 (555) 000-0000"
                                value={form.phone}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="contact-field">
                            <label className="contact-label">¿Qué te interesa?</label>
                            <div className="contact-interest">
                                {interestOptions.map(opt => (
                                    <button
                                        key={opt}
                                        type="button"
                                        className={`contact-interest-btn ${interest === opt ? 'active' : ''}`}
                                        onClick={() => setInterest(opt)}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="contact-field">
                            <label className="contact-label">Mensaje</label>
                            <textarea
                                className="contact-input contact-textarea"
                                name="message"
                                placeholder="Cuéntanos sobre la pieza que tienes en mente..."
                                value={form.message}
                                onChange={handleChange}
                                rows={5}
                            />
                        </div>

                        <button type="submit" className={`contact-submit${sent ? ' contact-submit--sent' : ''}`}>
                            {sent ? '✓ Mensaje enviado — abrimos WhatsApp' : 'Enviar Mensaje'}
                        </button>

                    </motion.form>

                </div>
            </div>
        </section>
    );
};

export default Contact;
