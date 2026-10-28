export default function AboutPage() {
    return (
        <main className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
            <section style={{ maxWidth: '800px', margin: '0 auto', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '2rem' }}>Our Story</h1>
                <p style={{ fontSize: '1.25rem', lineHeight: '1.8', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    At Sangeet Sarathi, we believe that every musician deserves an instrument that resonates with their soul. Established in 1993, we have spent over three decades serving as a cornerstone of the music community in Palakkad. What started as a small passion project has evolved into a premier destination for musicians, students, and professionals alike.
                </p>
                <div style={{ width: '60px', height: '4px', background: 'var(--accent-gold)', margin: '3rem auto' }}></div>
            </section>

            <section style={{ margin: '6rem 0' }}>
                <h2 style={{ textAlign: 'center', marginBottom: '4rem', fontSize: '2.5rem' }}>What Our Customers Say</h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <div style={{ color: 'var(--accent-gold)', fontSize: '1.5rem', marginBottom: '1rem' }}>★★★★★</div>
                        <h3 style={{ marginBottom: '0.5rem' }}>Expert Guidance</h3>
                        <p className="text-muted" style={{ fontStyle: 'italic' }}>
                            &quot;The staff doesn&apos;t just sell instruments; they understand them. Their guidance in picking the right guitar within my budget was invaluable.&quot;
                        </p>
                    </div>

                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <div style={{ color: 'var(--accent-gold)', fontSize: '1.5rem', marginBottom: '1rem' }}>★★★★★</div>
                        <h3 style={{ marginBottom: '0.5rem' }}>Quality Repairs</h3>
                        <p className="text-muted" style={{ fontStyle: 'italic' }}>
                            &quot;One of the few places where you can trust your precious instruments for repairs. They handled my guitar restringing and bridge repair with professional precision.&quot;
                        </p>
                    </div>

                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <div style={{ color: 'var(--accent-gold)', fontSize: '1.5rem', marginBottom: '1rem' }}>★★★★★</div>
                        <h3 style={{ marginBottom: '0.5rem' }}>Prompt Service</h3>
                        <p className="text-muted" style={{ fontStyle: 'italic' }}>
                            &quot;Highly impressed with their responsiveness. They address queries quickly and are very methodical in their approach to customer service.&quot;
                        </p>
                    </div>

                    <div className="glass-panel" style={{ padding: '2rem' }}>
                        <div style={{ color: 'var(--accent-gold)', fontSize: '1.5rem', marginBottom: '1rem' }}>★★★★★</div>
                        <h3 style={{ marginBottom: '0.5rem' }}>Diverse Inventory</h3>
                        <p className="text-muted" style={{ fontStyle: 'italic' }}>
                            &quot;A one-stop destination for everything from keyboards and drums to jazz instruments and tabla covers. If they don’t have it, they know how to get it.&quot;
                        </p>
                    </div>

                </div>
            </section>
        </main>
    );
}
