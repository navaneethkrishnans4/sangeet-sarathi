'use client';

import { useState } from 'react';
import Image from 'next/image';
import styles from './ImageGallery.module.css';

export default function ImageGallery({ images }: { images: string[] }) {
    const [selected, setSelected] = useState(0);

    if (!images || images.length === 0) return null;

    return (
        <div className={styles.gallery}>
            <div className={styles.mainContainer}>
                <Image
                    src={images[selected]}
                    alt="Product Main View"
                    fill
                    className={styles.mainImage}
                    sizes="(max-width: 768px) 100vw, 50vw"
                    priority
                    unoptimized
                />
            </div>

            {images.length > 1 && (
                <div className={styles.thumbnails}>
                    {images.map((img, idx) => (
                        <button
                            key={idx}
                            className={`${styles.thumbBtn} ${selected === idx ? styles.active : ''}`}
                            onClick={() => setSelected(idx)}
                        >
                            <div className={styles.thumbImgWrapper} style={{ position: 'relative', width: '100%', height: '100%' }}>
                                <Image
                                    src={img}
                                    alt={`View ${idx + 1}`}
                                    fill
                                    className={styles.thumbImg}
                                    sizes="100px"
                                    unoptimized
                                />
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
