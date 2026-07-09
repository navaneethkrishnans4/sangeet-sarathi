import Link from 'next/link';
import styles from './Hero.module.css';
import SearchBar from './SearchBar';

export default function Hero() {
    return (
        <section className={styles.hero}>
            {/* Background Ambience */}
            <div className={styles.bgText}>SANGEET</div>

            <div className={`container ${styles.content}`}>
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
                    <SearchBar />
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
