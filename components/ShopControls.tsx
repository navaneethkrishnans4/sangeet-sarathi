'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import styles from './ShopControls.module.css';

const categories = [
    { id: 'all', label: 'All Instruments' },
    { id: 'strings', label: 'Strings' },
    { id: 'percussion', label: 'Percussion' },
    { id: 'keys', label: 'Keys' },
    { id: 'wind', label: 'Wind' },
    { id: 'accessories', label: 'Accessories' },
    // Simplified list, but dropdown allows for more without clutter
];

export default function ShopControls() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const currentCategory = searchParams.get('category') || 'all';

    const createQueryString = useCallback(
        (name: string, value: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) {
                params.set(name, value);
            } else {
                params.delete(name);
            }
            return params.toString();
        },
        [searchParams]
    );

    const handleCategoryChange = (category: string) => {
        router.push(pathname + '?' + createQueryString('category', category === 'all' ? '' : category));
    };

    return (
        <div className={styles.controls}>
            {/* Quick Filter Pills (Keeping for common ones + Dropdown for scalability) */}
            <div className={styles.categories}>
                <label className={styles.label}>Filter by Category:</label>
                <select
                    value={currentCategory}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className={styles.select}
                >
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                    {/* Placeholder for future categories */}
                    <option value="traditional">Traditional</option>
                    <option value="studio">Studio Gear</option>
                </select>
            </div>
        </div>
    );
}
