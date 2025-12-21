import { getProductById } from '@/lib/data';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ImageGallery from '@/components/ImageGallery';

export default async function ProductPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const product = await getProductById(id);

    if (!product) {
        notFound();
    }

    return (
        <main className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
            <Link
                href="/shop"
                style={{
                    display: 'inline-block',
                    marginBottom: '2rem',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                }}
            >
                &larr; Back to Collection
            </Link>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem' }}>
                {/* Product Image Gallery Section */}
                <div className="glass-panel" style={{ borderRadius: '8px', overflow: 'hidden', padding: '1rem', background: 'rgba(255,255,255,0.02)' }}>
                    <ImageGallery images={product.images} />
                </div>

                {/* Product Info Section */}
                <div>
                    <span style={{ color: 'var(--accent-gold)', textTransform: 'uppercase', letterSpacing: '0.1em', fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                        {product.category}
                    </span>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '1rem' }}>
                        <h1 style={{ fontSize: '3rem', lineHeight: '1.1', margin: 0 }}>{product.name}</h1>
                    </div>
                    <p style={{ fontSize: '1rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '1rem' }}>
                        Model: #{product.model}
                    </p>

                    <p style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '2rem' }}>
                        {!product.price.startsWith('₹') && '₹'}{product.price}
                    </p>

                    <div style={{ marginBottom: '2.5rem' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', fontFamily: 'var(--font-body)' }}>Description</h3>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{product.description}</p>
                    </div>

                    <div style={{ marginBottom: '3rem' }}>
                        <h3 style={{ fontSize: '1.2rem', marginBottom: '1rem', fontFamily: 'var(--font-body)' }}>Specifications</h3>
                        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {product.specs && product.specs.map((spec, i) => (
                                <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
                                    <span style={{ width: '6px', height: '6px', background: 'var(--accent-gold)', borderRadius: '50%' }}></span>
                                    {spec}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <Link
                            href="/contact"
                            className="btn-primary"
                            style={{ flex: '1', textAlign: 'center', minWidth: '200px' }}
                        >
                            Call to Order
                        </Link>
                        <button className="btn-outline" style={{ flex: '1', minWidth: '200px' }}>
                            Ask a Question
                        </button>
                    </div>

                    <div style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.03)', padding: '1rem', borderRadius: '4px' }}>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                            <strong>Availability:</strong> <span style={{ color: '#fff' }}>
                                {product.stockStatus === 'in_stock' ? 'In Stock' :
                                    product.stockStatus === 'on_order' ? 'Available on Order' : 'Out of Stock'}
                            </span>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
}
