'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, FormEvent, useRef } from 'react';
import { performAISearch } from '@/lib/aiSearch';
import { getAllProducts } from '@/lib/data';
import Fuse from 'fuse.js';

export default function SearchBar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [term, setTerm] = useState(searchParams.get('q') || '');
    const [isSearching, setIsSearching] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSearch = async (e: FormEvent) => {
        e.preventDefault();
        if (!term) return;

        setIsSearching(true);
        try {
            // First try local fuzzy match (fast path)
            const products = await getAllProducts();
            
            const fuse = new Fuse(products, {
                keys: ['name', 'model', 'keywords'],
                threshold: 0.4,
                ignoreLocation: true
            });
            const results = fuse.search(term);

            if (results.length > 0) {
                // Skip AI if we have local fuzzy matches for speed
                const params = new URLSearchParams(searchParams.toString());
                params.delete('ai_search_ids');
                params.set('q', term);
                router.push(`/shop?${params.toString()}`);
                setIsSearching(false);
                return;
            }

            // Fallback to AI semantic search (slow path)
            const catalog = products.map(p => ({
                id: p.id,
                name: p.name,
                description: p.description,
                category: p.category
            }));

            const ids = await performAISearch(term, catalog);
            
            const params = new URLSearchParams(searchParams.toString());
            if (ids.length > 0) {
                params.set('ai_search_ids', ids.join(','));
                params.set('q', term); // keep term for display
            } else {
                params.delete('ai_search_ids');
                params.set('q', term); // fallback to standard query
            }
            router.push(`/shop?${params.toString()}`);
        } catch (error) {
            console.error("Search error", error);
            // fallback
            const params = new URLSearchParams(searchParams.toString());
            params.set('q', term);
            router.push(`/shop?${params.toString()}`);
        } finally {
            setIsSearching(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsSearching(true);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const base64Full = evt.target?.result as string;
                // e.g. "data:image/jpeg;base64,....."
                const [header, base64Data] = base64Full.split(',');
                const mimeType = header.split(':')[1].split(';')[0];

                const products = await getAllProducts();
                const catalog = products.map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    category: p.category
                }));

                const ids = await performAISearch("Find products that look like this image.", catalog, base64Data, mimeType);
                
                const params = new URLSearchParams(searchParams.toString());
                if (ids.length > 0) {
                    params.set('ai_search_ids', ids.join(','));
                    params.set('q', "Image Search");
                }
                router.push(`/shop?${params.toString()}`);
                setIsSearching(false);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error("Image search error", error);
            setIsSearching(false);
        }
    };

    return (
        <form onSubmit={handleSearch} style={{ marginBottom: '1.5rem', width: '100%', maxWidth: '600px', display: 'flex', gap: '0.5rem', alignItems: 'stretch' }}>
            <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                <input
                    type="text"
                    placeholder="Search with AI... (e.g. 'thabla')"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    style={{
                        width: '100%',
                        padding: '1rem 3.5rem 1rem 1.5rem',
                        borderRadius: '9999px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--marketing-glass-border)',
                        color: '#fff',
                        fontSize: '1rem',
                        outline: 'none',
                        backdropFilter: 'blur(10px)'
                    }}
                />
                <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                        position: 'absolute',
                        right: '1rem',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        color: 'var(--accent-gold)',
                        opacity: isSearching ? 0.5 : 1
                    }}
                    disabled={isSearching}
                    title="Search by Image"
                >
                    📷
                </button>
                <input 
                    type="file" 
                    accept="image/*" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handleImageUpload} 
                />
            </div>
            <button
                type="submit"
                className="btn-primary"
                disabled={isSearching}
                style={{
                    padding: '0 2rem',
                    borderRadius: '9999px',
                    fontSize: '0.9rem',
                    opacity: isSearching ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}
            >
                {isSearching ? 'Thinking...' : 'Search'}
            </button>
        </form>
    );
}
