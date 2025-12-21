export default function ContactPage() {
    return (
        <main className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem', minHeight: '80vh' }}>
            <h1 style={{ fontSize: '3.5rem', marginBottom: '2rem' }}>Visit Us</h1>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem' }}>
                <div>
                    <h2 style={{ fontSize: '2rem', marginBottom: '1.5rem', color: 'var(--accent-gold)' }}>Sangeet Sarathi</h2>
                    <address style={{ fontStyle: 'normal', color: 'var(--text-secondary)', fontSize: '1.2rem', lineHeight: '1.6', marginBottom: '2rem' }}>
                        Govind Vilas building, junction,<br />
                        Court Rd, Sultanpet,<br />
                        Palakkad, Kerala 678001<br />
                        India
                    </address>

                    <div style={{ marginBottom: '2rem' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Phone</h3>
                        <p style={{ fontSize: '1.5rem' }}>+91 79070 57326</p>
                    </div>

                    <div>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Hours</h3>
                        <p style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 'bold' }}>
                            Open on all days<br />
                            10:00 AM to 7:45 PM
                        </p>
                    </div>
                </div>

                <a
                    href="https://share.google/ZA39QziDlhBtQ4spI"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="glass-panel"
                    style={{
                        height: '400px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: '#222',
                        textDecoration: 'none',
                        transition: 'transform 0.3s ease'
                    }}
                >
                    <div style={{ textAlign: 'center' }}>
                        <span style={{ fontSize: '3rem', display: 'block', marginBottom: '1rem' }}>📍</span>
                        <p style={{ color: 'var(--accent-gold)', fontSize: '1.2rem' }}>Click to Open in Google Maps</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Get Directions</p>
                    </div>
                </a>
            </div>
        </main>
    );
}
