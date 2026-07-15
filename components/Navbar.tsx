'use client';

import Link from 'next/link';
import { useState } from 'react';
import styles from './Navbar.module.css';

export default function Navbar() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleMenu = () => {
        setIsOpen(!isOpen);
    };

    const closeMenu = () => {
        setIsOpen(false);
    };

    return (
        <nav className={styles.nav}>
            <div className={`container ${styles.content}`}>
                <Link href="/" className={styles.logo} onClick={closeMenu}>
                    Sangeet <span>Sarathi</span>
                </Link>

                {/* Hamburger menu toggle button */}
                <button 
                    className={`${styles.hamburger} ${isOpen ? styles.hamburgerOpen : ''}`} 
                    onClick={toggleMenu}
                    aria-label="Toggle Menu"
                >
                    <span className={styles.bar}></span>
                    <span className={styles.bar}></span>
                    <span className={styles.bar}></span>
                </button>

                {/* Navigation menu wrapper */}
                <div className={`${styles.menu} ${isOpen ? styles.menuOpen : ''}`}>
                    <ul className={styles.links}>
                        <li><Link href="/" className={styles.link} onClick={closeMenu}>Home</Link></li>
                        <li><Link href="/shop" className={styles.link} onClick={closeMenu}>Collection</Link></li>
                        <li><Link href="/about" className={styles.link} onClick={closeMenu}>Our Story</Link></li>
                        <li><Link href="/contact" className={styles.link} onClick={closeMenu}>Contact</Link></li>
                    </ul>

                    <Link href="/contact" className={styles.cta} onClick={closeMenu}>
                        Visit Store
                    </Link>
                </div>
            </div>
        </nav>
    );
}
