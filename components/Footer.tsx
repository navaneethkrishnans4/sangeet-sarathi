import Link from 'next/link';

export default function Footer() {
    return (
        <footer style={{ borderTop: '1px solid var(--marketing-glass-border)', padding: '4rem 0 2rem', marginTop: 'auto', background: '#080808' }}>
            <div className="container">
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '3rem', marginBottom: '3rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Sangeet <span style={{ color: 'var(--accent-gold)' }}>Sarathi</span></h3>
                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
                            Your destination for premium musical instruments in Palakkad.
                        </p>
                    </div>

                    <div>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Exploration</h4>
                        <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <li><Link href="/shop" className="hover:text-gold">All Instruments</Link></li>
                            <li><Link href="/shop?category=strings" className="hover:text-gold">Strings</Link></li>
                            <li><Link href="/shop?category=percussion" className="hover:text-gold">Percussion</Link></li>
                            <li><Link href="/about" className="hover:text-gold">Our Story</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Visit Us</h4>
                        <ul style={{ listStyle: 'none', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <li>Govind Vilas building, Junction,</li>
                            <li>Court Rd, Sultanpet,</li>
                            <li>Palakkad, Kerala 678001</li>
                            <li>+91 79070 57326</li>
                            <li><span style={{ fontWeight: 'bold', color: '#fff' }}>Open on all days: 10:00 AM - 7:45 PM</span></li>
                        </ul>
                    </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <p>&copy; {new Date().getFullYear()} Sangeet Sarathi. All rights reserved.</p>
                    <Link href="/admin/login" style={{ opacity: 0.5 }}>Admin Access</Link>
                </div>
            </div>
        </footer>
    );
}
