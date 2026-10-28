import { getProducts } from '@/lib/data';
import ProductCard from '@/components/ProductCard';
import ShopControls from '@/components/ShopControls';
import SearchBar from '@/components/SearchBar';
import { Suspense } from 'react';

export default async function ShopPage({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; q?: string; ai_search_ids?: string }>;
}) {
    const params = await searchParams;
    const category = params.category || 'all';
    const query = params.q || '';
    const aiSearchIds = params.ai_search_ids ? params.ai_search_ids.split(',') : undefined;
    const products = await getProducts(category, query, aiSearchIds);

    return (
        <main className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
            <header style={{ marginBottom: '3rem', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3.5rem', marginBottom: '1rem' }} className="animate-fade-in">
                    Shop Instruments
                </h1>
                <p className="animate-fade-in" style={{ color: 'var(--text-secondary)' }}>
                    {category === 'all'
                        ? 'Explore our complete collection of musical excellence.'
                        : `Browsing ${category} collection.`}
                </p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '2rem' }}>
                <Suspense fallback={<div>Loading search...</div>}>
                    <SearchBar />
                </Suspense>
            </div>

            <Suspense fallback={<div>Loading controls...</div>}>
                <ShopControls />
            </Suspense>

            {products.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <p>No products found matching your criteria.</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                    gap: '2rem'
                }}>
                    {products.map((product) => (
                        <ProductCard key={product.id} product={product} />
                    ))}
                </div>
            )}
        </main>
    );
}
