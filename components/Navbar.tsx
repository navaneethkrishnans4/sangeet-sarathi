import Link from 'next/link';
import styles from './Navbar.module.css';

export default function Navbar() {
    return (
        <nav className={styles.nav}>
            <div className={`container ${styles.content}`}>
                <Link href="/" className={styles.logo}>
                    Sangeet <span>Sarathi</span>
                </Link>

                <ul className={styles.links}>
                    <li><Link href="/" className={styles.link}>Home</Link></li>
                    <li><Link href="/shop" className={styles.link}>Collection</Link></li>
                    <li><Link href="/about" className={styles.link}>Our Story</Link></li>
                    <li><Link href="/contact" className={styles.link}>Contact</Link></li>
                </ul>

                <Link href="/contact" className={styles.cta}>
                    Visit Store
                </Link>
            </div>
        </nav>
    );
}
