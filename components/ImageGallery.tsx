'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Lightbox from 'yet-another-react-lightbox';
import Zoom from 'yet-another-react-lightbox/plugins/zoom';
import 'yet-another-react-lightbox/styles.css';
import styles from './ImageGallery.module.css';

const AUTO_CYCLE_MS = 3500;

export default function ImageGallery({ images }: { images: string[] }) {
    const [selected, setSelected] = useState(0);
    const [progress, setProgress] = useState(0);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const startCycle = () => {
        if (images.length <= 1) return;
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (progressRef.current) clearInterval(progressRef.current);
        setProgress(0);
        let p = 0;
        progressRef.current = setInterval(() => {
            p += 100 / (AUTO_CYCLE_MS / 50);
            setProgress(Math.min(p, 100));
        }, 50);
        intervalRef.current = setInterval(() => {
            setSelected(prev => (prev + 1) % images.length);
            setProgress(0);
            p = 0;
        }, AUTO_CYCLE_MS);
    };

    useEffect(() => {
        startCycle();
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (progressRef.current) clearInterval(progressRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images.length]);

    const handleSelect = (idx: number) => {
        setSelected(idx);
        startCycle();
    };

    const openLightbox = (idx: number) => {
        setLightboxIndex(idx);
        setLightboxOpen(true);
    };

    if (!images || images.length === 0) return null;

    const slides = images.map(src => ({ src }));

    return (
        <>
            <div className={styles.gallery}>
                {/* ── Hero Image ── */}
                <div className={styles.heroWrapper}>
                    <div
                        className={styles.heroContainer}
                        onClick={() => openLightbox(selected)}
                        title="Click to view full screen"
                    >
                        <Image
                            src={images[selected]}
                            alt="Product view"
                            fill
                            className={styles.heroImage}
                            sizes="(max-width: 768px) 100vw, 50vw"
                            priority
                            unoptimized
                        />
                        {/* Gradient overlay */}
                        <div className={styles.heroOverlay} />

                        {/* Expand hint */}
                        <div className={styles.expandHint}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="15 3 21 3 21 9" />
                                <polyline points="9 21 3 21 3 15" />
                                <line x1="21" y1="3" x2="14" y2="10" />
                                <line x1="3" y1="21" x2="10" y2="14" />
                            </svg>
                            <span>Full Screen</span>
                        </div>

                        {/* Image counter badge */}
                        {images.length > 1 && (
                            <span className={styles.badge}>
                                {selected + 1} / {images.length}
                            </span>
                        )}
                    </div>

                    {/* Auto-cycle progress bar */}
                    {images.length > 1 && (
                        <div className={styles.progressTrack}>
                            <div className={styles.progressBar} style={{ width: `${progress}%` }} />
                        </div>
                    )}
                </div>

                {/* ── Additional Images Grid ── */}
                {images.length > 1 && (
                    <div className={styles.grid}>
                        {images.map((img, idx) => (
                            <button
                                key={idx}
                                className={`${styles.gridItem} ${selected === idx ? styles.gridItemActive : ''}`}
                                onClick={() => handleSelect(idx)}
                                aria-label={`View image ${idx + 1}`}
                            >
                                <div className={styles.gridImgWrapper}>
                                    <Image
                                        src={img}
                                        alt={`Product view ${idx + 1}`}
                                        fill
                                        className={styles.gridImg}
                                        sizes="150px"
                                        unoptimized
                                    />
                                    {selected === idx && (
                                        <div className={styles.activeShimmer} />
                                    )}
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── YARL Lightbox ── */}
            <Lightbox
                open={lightboxOpen}
                close={() => setLightboxOpen(false)}
                slides={slides}
                index={lightboxIndex}
                plugins={[Zoom]}
                zoom={{
                    maxZoomPixelRatio: 4,
                    zoomInMultiplier: 1.5,
                    doubleTapDelay: 300,
                    doubleClickDelay: 300,
                    keyboardMoveDistance: 50,
                    wheelZoomDistanceFactor: 100,
                    pinchZoomDistanceFactor: 100,
                    scrollToZoom: true,
                }}
                styles={{
                    container: {
                        background: 'rgba(5, 5, 5, 0.97)',
                        backdropFilter: 'blur(20px)',
                    },
                    button: {
                        color: '#D4AF37',
                        filter: 'none',
                    },
                }}
                carousel={{
                    finite: false,
                    preload: 2,
                    imageFit: 'contain',
                }}
            />
        </>
    );
}
