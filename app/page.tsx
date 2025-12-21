import Hero from '../components/Hero';
import CategoryGrid from '../components/CategoryGrid';
import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <Hero />
      <CategoryGrid />

      {/* Legacy & Trust Section - Using the new copy */}
      <section className="container" style={{ padding: '8rem 2rem' }}>
        <h2 style={{ fontSize: '3rem', marginBottom: '3rem', textAlign: 'center' }}>Why Choose Sangeet Sarathi?</h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-gold)' }}>Legacy & Trust</h3>
            <p className="text-muted">Serving the music community for over 32 years. Established in 1993, we are a cornerstone of Palakkad&apos;s musical heritage.</p>
          </div>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-gold)' }}>One-Stop Music Hub</h3>
            <p className="text-muted">Specialized in sales and expert repair of a wide range of instruments, including Guitars, Keyboards, Drums, and traditional Indian instruments like Tablas.</p>
          </div>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-gold)' }}>Skilled Technicians</h3>
            <p className="text-muted">In-house repair services for high-end instruments, ensuring your gear stays in peak performance condition.</p>
          </div>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-gold)' }}>Customer-Centric</h3>
            <p className="text-muted">Renowned for a &quot;satisfaction-first&quot; policy, offering personalized consultations to ensure every musician finds their perfect match.</p>
          </div>
          <div className="glass-panel" style={{ padding: '2rem' }}>
            <h3 style={{ marginBottom: '1rem', color: 'var(--accent-gold)' }}>Prime Location</h3>
            <p className="text-muted">Conveniently located at Court Road, Sultanpet, making it easily accessible for the local music community.</p>
          </div>
        </div>
      </section>

      {/* Featured Testimonial */}
      <section style={{ background: 'rgba(255,255,255,0.02)', padding: '6rem 2rem', textAlign: 'center' }}>
        <div className="container" style={{ maxWidth: '800px' }}>
          <p style={{ fontSize: '1.5rem', fontStyle: 'italic', marginBottom: '2rem', lineHeight: '1.6' }}>
            &quot;Sangeet Sarathi is more than just a store; it&apos;s a legacy. Their deep knowledge of musical instruments and dedication to after-sales service is why I’ve been a loyal customer for years. Highly recommended for beginners and pros alike!&quot;
          </p>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#333' }}></div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ fontWeight: 'bold', margin: 0 }}>Arjun Nair</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', margin: 0 }}>Professional Musician</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '8rem 2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Ready to Find Your Sound?</h2>
        <p className="text-muted" style={{ marginBottom: '2rem' }}>Visit our showroom or explore our collection online.</p>
        <Link href="/shop" className="btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.1rem' }}>Explore Collection</Link>
      </section>
    </main>
  );
}
