import { db } from './firebase';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';

export interface Product {
    id: string;
    model: string;
    name: string;
    category: 'strings' | 'percussion' | 'keys' | 'wind' | 'accessories';
    price: string;
    images: string[];
    description: string;
    specs: string[];
    stockStatus: 'in_stock' | 'out_of_stock' | 'on_order';
    visible: boolean;
    dealer?: string; // Admin only
    dealerPrice?: string; // Admin only
    discountPrice?: string; // Visible (Sale price)
    keywords?: string[]; // Search keywords
}

import Fuse from "fuse.js";

// Convert Firestore doc to Product type safely
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const docToProduct = (doc: any): Product => {
    const data = doc.data();
    // Helper to ensure we always have an array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const normalizeImages = (imgData: any): string[] => {
        if (Array.isArray(imgData) && imgData.length > 0) return imgData;
        if (typeof imgData === 'string' && imgData.length > 0) return [imgData];
        return ['https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?q=80&w=800&auto=format&fit=crop'];
    };

    return {
        id: doc.id,
        model: data.model || 'N/A',
        name: data.name || 'Unknown Product',
        category: data.category || 'accessories',
        price: String(data.price || '₹0'),
        images: normalizeImages(data.images || data.image),
        description: data.description || '',
        specs: data.specs || [],
        stockStatus: data.stockStatus || 'in_stock',
        visible: data.visible !== false, // Default to true if missing
        dealer: data.dealer || '',
        dealerPrice: String(data.dealerPrice || ''),
        discountPrice: String(data.discountPrice || ''),
        keywords: Array.isArray(data.keywords) ? data.keywords : []
    };
};

export async function getAllProducts() {
    try {
        const querySnapshot = await getDocs(collection(db, "products"));
        return querySnapshot.docs.map(docToProduct);
    } catch (error) {
        console.error("Error fetching products:", error);
        return [];
    }
}

export async function getProductById(id: string) {
    try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docToProduct(docSnap);
        } else {
            return undefined;
        }
    } catch (error) {
        console.error("Error fetching product by ID:", error);
        return undefined;
    }
}

export async function getProducts(category: string, queryText: string, aiSearchIds?: string[]) {
    try {
        const q = collection(db, "products");
        const querySnapshot = await getDocs(q);
        let products = querySnapshot.docs.map(docToProduct);

        // Filter out hidden products for the public shop
        products = products.filter(p => p.visible !== false);

        if (category && category !== 'all') {
            products = products.filter(p => p.category === category);
        }

        if (aiSearchIds && aiSearchIds.length > 0) {
            products = products.filter(p => aiSearchIds.includes(p.id));
        } else if (queryText) {
            const fuse = new Fuse(products, {
                keys: ['name', 'model', 'keywords'],
                threshold: 0.4,
                ignoreLocation: true
            });
            const results = fuse.search(queryText);
            products = results.map(result => result.item);
        }

        return products;
    } catch (error) {
        console.error("Error fetching filtered products:", error);
        return [];
    }
}

export async function getProductsByCategory(category: string) {
    return getProducts(category, '');
}
