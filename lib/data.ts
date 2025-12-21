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
}

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
        visible: data.visible !== false // Default to true if missing
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

export async function getProducts(category: string, queryText: string) {
    try {
        const q = collection(db, "products");
        const querySnapshot = await getDocs(q);
        let products = querySnapshot.docs.map(docToProduct);

        // Filter out hidden products for the public shop
        products = products.filter(p => p.visible !== false);

        if (category && category !== 'all') {
            products = products.filter(p => p.category === category);
        }

        if (queryText) {
            const lowerQuery = queryText.toLowerCase();
            products = products.filter(p =>
                p.name.toLowerCase().includes(lowerQuery) ||
                p.model.toLowerCase().includes(lowerQuery)
            );
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
