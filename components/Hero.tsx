import Link from 'next/link';
import styles from './Hero.module.css';
import SearchBar from './SearchBar';
import { Suspense } from 'react';

export default function Hero() {
    return (
        <section className={styles.hero}>
            {/* Background Ambience */}
            <div className={styles.bgText}>SANGEET</div>

            <div className={`container ${styles.content}`}>
                {/* Big Button at the top to navigate to Trinity Exam Enrollment Portal */}
                <div className="animate-fade-in" style={{ width: '100%', maxWidth: '720px', margin: '0 auto 2rem auto' }}>
                    <Link
                        href="/trinityexamenrollmentportal"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '1rem',
                            padding: '1.1rem 1.6rem',
                            borderRadius: '22px',
                            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.25), rgba(15, 23, 42, 0.9))',
                            border: '2px solid rgba(245, 158, 11, 0.9)',
                            boxShadow: '0 12px 36px rgba(245, 158, 11, 0.28)',
                            textDecoration: 'none',
                            color: '#ffffff',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                            cursor: 'pointer'
                        }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', textAlign: 'left' }}>
                            <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '14px',
                                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.7rem',
                                flexShrink: 0,
                                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.45)'
                            }}>
                                🎓
                            </div>
                            <div>
                                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', color: '#fbbf24' }}>
                                    Trinity College London • Centre Kochi (4048)
                                </div>
                                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: '#ffffff', lineHeight: 1.25, marginTop: '2px' }}>
                                    Trinity Exam Enrollment Portal
                                </div>
                                <div style={{ fontSize: '0.82rem', color: '#e2e8f0', marginTop: '2px' }}>
                                    Digital candidate registration, fee calculation & direct UPI payment
                                </div>
                            </div>
                        </div>
                        <div style={{
                            background: '#fbbf24',
                            color: '#0f172a',
                            fontWeight: 900,
                            padding: '0.75rem 1.4rem',
                            borderRadius: '12px',
                            fontSize: '0.95rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.4rem',
                            flexShrink: 0,
                            boxShadow: '0 4px 14px rgba(251, 191, 36, 0.4)'
                        }}>
                            Open Portal →
                        </div>
                    </Link>
                </div>

                <h2 className={`${styles.subtitle} animate-fade-in`}>Est. Palakkad, Kerala</h2>
                <h1 className={`${styles.title} animate-fade-in`}>
                    Resonating the <br />
                    <span style={{ fontStyle: 'italic', fontFamily: 'var(--font-heading)' }}>Soul of Music</span>
                </h1>
                <p className={`${styles.description} animate-fade-in`}>
                    Discover a curated collection of premium musical instruments.
                    From traditional crafted pieces to modern professional gear.
                </p>

                <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                    <Suspense fallback={<div>Loading search...</div>}>
                        <SearchBar />
                    </Suspense>
                    <div className={styles.actions}>
                        <Link href="/shop" className="btn-primary">
                            Explore Collection
                        </Link>
                        <Link href="/contact" className="btn-outline">
                            Visit Showroom
                        </Link>
                    </div>
                </div>
            </div>

            <div className={styles.scrollIndicator}>
                <span>Scroll</span>
                <div className={styles.line}></div>
            </div>
        </section>
    );
}
