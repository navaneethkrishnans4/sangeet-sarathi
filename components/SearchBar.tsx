'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, FormEvent } from 'react';

export default function SearchBar() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [term, setTerm] = useState(searchParams.get('q') || '');

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (term) {
            params.set('q', term);
        } else {
            params.delete('q');
        }
        router.push(`/shop?${params.toString()}`);
    };

    return (
        <form onSubmit={handleSearch} style={{ marginBottom: '1.5rem', width: '100%', maxWidth: '600px', display: 'flex', gap: '0.5rem' }}>
            <input
                type="text"
                placeholder="Search by Name or Model Number..."
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                style={{
                    flex: 1,
                    padding: '1rem 1.5rem',
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
                type="submit"
                className="btn-primary"
                style={{
                    padding: '0 2rem',
                    borderRadius: '9999px',
                    fontSize: '0.9rem'
                }}
            >
                Search
            </button>
        </form>
    );
}
