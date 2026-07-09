import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, limit, query } from 'firebase/firestore';

export async function GET() {
    try {
        const q = query(collection(db, 'products'), limit(5));
        const querySnapshot = await getDocs(q);
        const products = querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        return NextResponse.json({ count: querySnapshot.size, products });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
