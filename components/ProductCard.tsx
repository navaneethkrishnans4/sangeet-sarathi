import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/lib/data';
import styles from './ProductCard.module.css';

export default function ProductCard({ product }: { product: Product }) {
    const getStatusColor = (status: Product['stockStatus']) => {
        switch (status) {
            case 'in_stock': return '#10B981'; // Green
            case 'out_of_stock': return '#EF4444'; // Red
            case 'on_order': return '#F59E0B'; // Amber
            default: return '#9CA3AF';
        }
    };

    const getStatusText = (status: Product['stockStatus']) => {
        switch (status) {
            case 'in_stock': return 'In Stock';
            case 'out_of_stock': return 'Out of Stock';
            case 'on_order': return 'Available on Order';
            default: return 'Unknown';
        }
    };

    return (
        <Link href={`/shop/${product.id}`} className={styles.card}>
            <div className={styles.imageContainer}>
                <Image
                    src={product.images && product.images.length > 0 ? product.images[0] : '/placeholder.jpg'}
                    alt={product.name}
                    fill
                    className={styles.image}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    unoptimized
                />
            </div>
            <div className={styles.content}>
                <span className={styles.category}>{product.category}</span>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'baseline', flexWrap: 'wrap' }}>
                    <h3 className={styles.name} style={{ marginBottom: 0 }}>{product.name}</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        #{product.model}
                    </span>
                </div>

                <div className={styles.priceContainer}>
                    {product.discountPrice && parseFloat(String(product.discountPrice).replace(/[^0-9.]/g, '')) > 0 ? (
                        <>
                            <span className={styles.originalPrice}>
                                {!String(product.price).startsWith('₹') && '₹'}{product.price}
                            </span>
                            <span className={styles.salePrice}>
                                {!String(product.discountPrice).startsWith('₹') && '₹'}{product.discountPrice}
                            </span>
                        </>
                    ) : (
                        <span className={styles.price}>
                            {!String(product.price).startsWith('₹') && '₹'}{product.price}
                        </span>
                    )}
                </div>

                <p className={styles.stock} style={{ color: getStatusColor(product.stockStatus) }}>
                    {getStatusText(product.stockStatus)}
                </p>
            </div>
        </Link>
    );
}
