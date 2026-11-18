import Hero from '@/components/Hero';
import CategoryGrid from '@/components/CategoryGrid';
import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <Hero />

      {/* Trinity College London Digital Exam Enrollment Portal Section */}
      <section className="container" style={{ padding: '3.5rem 1.5rem 2rem 1.5rem' }}>
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.98))',
          border: '2px solid rgba(245, 158, 11, 0.7)',
          borderRadius: '28px',
          padding: '2.5rem 2rem',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 40px rgba(245, 158, 11, 0.15)',
          display: 'flex',
          flexDirection: 'column',
          gap: '2rem'
        }}>
          {/* Top Branding Bar with National Academy of Music & Trinity Logos */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1.5rem',
            paddingBottom: '1.5rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.12)'
          }}>
            {/* National Academy of Music Logo Card */}
            <div style={{
              background: '#ffffff',
              padding: '0.6rem 1.25rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
            }}>
              <img
                src="/images/national-academy-of-music.png"
                alt="National Academy of Music"
                style={{ height: '42px', width: 'auto', objectFit: 'contain' }}
              />
            </div>

            {/* Official Centre Badge */}
            <div style={{ textAlign: 'center' }}>
              <span style={{
                background: 'rgba(245, 158, 11, 0.18)',
                border: '1px solid rgba(245, 158, 11, 0.5)',
                color: '#fbbf24',
                padding: '0.45rem 1.2rem',
                borderRadius: '999px',
                fontSize: '0.85rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase'
              }}>
                Exam Centre: Kochi (4048)
              </span>
            </div>

            {/* Trinity College London Logo Card */}
            <div style={{
              background: '#ffffff',
              padding: '0.6rem 1.25rem',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.25)'
            }}>
              <img
                src="/images/trinity-college-london.png"
                alt="Trinity College London"
                style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
              />
            </div>
          </div>

          {/* Title, Details & CTA Action */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '2rem'
          }}>
            <div style={{ maxWidth: '660px' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#fbbf24', marginBottom: '0.35rem' }}>
                Official Examination Registration
              </div>
              <h2 style={{
                fontSize: 'clamp(1.6rem, 3.2vw, 2.3rem)',
                fontWeight: 900,
                color: '#ffffff',
                marginBottom: '0.75rem',
                lineHeight: 1.25
              }}>
                Trinity College London Digital Exam Enrollment Portal
              </h2>
              <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, margin: 0 }}>
                Direct student enrollment for Trinity Digital Exams (Classical & Jazz and Rock & Pop). Choose Technical Work or Repertoire-Only pathways, verify entries, and complete payment directly via UPI.
              </p>
            </div>

            <Link
              href="/trinityexamenrollmentportal"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0f172a',
                fontWeight: 900,
                fontSize: '1.05rem',
                padding: '1.15rem 2.4rem',
                borderRadius: '16px',
                textDecoration: 'none',
                boxShadow: '0 10px 28px rgba(245, 158, 11, 0.45)',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                flexShrink: 0,
                cursor: 'pointer'
              }}
            >
              <span>Enter Enrollment Portal</span>
              <span style={{ fontSize: '1.3rem', lineHeight: 1 }}>→</span>
            </Link>
          </div>
        </div>
      </section>

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
