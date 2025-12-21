import Link from 'next/link';
import Image from 'next/image';
import styles from './CategoryGrid.module.css';

const categories = [
    { id: 'strings', name: 'Strings', image: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?q=80&w=800&auto=format&fit=crop' },
    { id: 'percussion', name: 'Percussion', image: 'https://images.unsplash.com/photo-1543443436-16d2d437494b?q=80&w=800&auto=format&fit=crop' },
    { id: 'keys', name: 'Keys', image: 'https://images.unsplash.com/photo-1520523839774-a8e64f320131?q=80&w=800&auto=format&fit=crop' },
    { id: 'wind', name: 'Wind', image: 'https://images.unsplash.com/photo-1573871666457-7c7329118cf9?q=80&w=800&auto=format&fit=crop' },
];

export default function CategoryGrid() {
    return (
        <section className={styles.section}>
            <div className={`container`}>
                <div className={styles.header}>
                    <div>
                        <h2 className={styles.heading}>Our Collection</h2>
                        <p className="text-gold">Curated instruments for every artist</p>
                    </div>

                </div>

                <div className={styles.grid}>
                    {categories.map((cat) => (
                        <Link key={cat.id} href={`/shop?category=${cat.id}`} className={styles.card}>
                            <div className={styles.imageWrapper} style={{ position: 'relative', height: '300px', width: '100%' }}>
                                <Image
                                    src={cat.image}
                                    alt={cat.name}
                                    fill
                                    className={styles.cardImage}
                                    style={{ objectFit: 'cover' }}
                                    sizes="(max-width: 768px) 100vw, 33vw"
                                    unoptimized
                                />
                            </div>
                            <div className={styles.cardContent}>
                                <h3 className={styles.cardTitle}>{cat.name}</h3>
                                <span className={styles.link}>View Collection &rarr;</span>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
