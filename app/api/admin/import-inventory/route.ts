import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// Helper to guess category
function guessCategory(name: string): string {
    const lower = name.toLowerCase();

    const keywords: Record<string, string[]> = {
        strings: ['guitar', 'ukulele', 'violin', 'veena', 'sitar', 'tanpura', 'mandolin', 'banjo', 'string', 'capo'],
        keys: ['keyboard', 'piano', 'harmonium', 'synthesizer', 'casio', 'yamaha psr', 'key'],
        percussion: ['drum', 'tabla', 'dholak', 'mridangam', 'conga', 'bongo', 'cajon', 'ghatam', 'kanjira', 'thavil', 'chenda', 'edakka', 'timki', 'shaker', 'tambourine', 'cymbal', 'stick', 'skin', 'head'],
        wind: ['flute', 'bansuri', 'clarinet', 'sax', 'trumpet', 'harmonica', 'melodica', 'nadaswaram'],
        accessories: ['bag', 'case', 'cover', 'stand', 'cable', 'mic', 'tuner', 'metronome', 'pick', 'strap', 'rosin', 'bow', 'mute', 'reed', 'oil', 'polish', 'adapter', 'pedal', 'amp', 'speaker', 'belt']
    };

    for (const [cat, words] of Object.entries(keywords)) {
        if (words.some(w => lower.includes(w))) return cat;
    }

    return 'accessories'; // Default fallback
}

export async function GET() {
    try {
        const filePath = path.join(process.cwd(), 'items_temp.xlsx');
        if (!fs.existsSync(filePath)) {
            return NextResponse.json({ error: 'Excel file not found at ' + filePath }, { status: 404 });
        }

        const buf = fs.readFileSync(filePath);
        const workbook = XLSX.read(buf, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        // Batch writes (limit 500 per batch)
        const productsRef = collection(db, 'products');

        // 1. Delete existing products
        // Note: For large collections, this should be done carefully. Assuming small collection for now.
        const snapshot = await getDocs(productsRef);
        const deleteBatch = writeBatch(db);
        snapshot.docs.forEach((d) => {
            deleteBatch.delete(d.ref);
        });
        await deleteBatch.commit();
        console.log(`Deleted ${snapshot.size} existing products.`);

        // 2. Process new data
        let batch = writeBatch(db);
        let count = 0;
        let batchCount = 0;
        const processedItems = [];

        for (const row of data) {
            // Row structure: [ID, Name, Empty, Dealer]
            // Skip header if it looks like header, but file seems to have data in first row according to inspection.
            // Inspection showed: [1, 'Bag...', empty, 'Dealer']

            // Row structure based on Export: 
            // [0:ID, 1:Model, 2:Name, 3:Category, 4:Dealer, 5:Dealer Price, 6:Selling Price, 7:Discount Price, 8:Stock, 9:Visible, 10:Desc, 11:Image]
            // We need to be flexible. If using the OLD Items file, structure was [ID, Name, Empty, Dealer]
            // Let's detect schema based on row length or basic validation.

            let id, name, dealer, price, dealerPrice, discountPrice, category, description, stock;

            if (row.length === 4) {
                // Old format: [ID, Name, Empty, Dealer]
                id = row[0];
                name = row[1];
                dealer = row[3];
                price = 'Call for Price';
                dealerPrice = '';
                discountPrice = '';
                stock = 'in_stock';
                category = guessCategory(name);
                description = `Genuine ${name} available at Sangeet Sarathi.`;
            } else {
                // Full/New Format (Matches Export)
                id = row[0];
                // row[1] is model, we can use id as model if needed
                name = row[2];
                category = row[3] || guessCategory(name);
                dealer = row[4];
                dealerPrice = row[5];
                price = row[6] || 'Call for Price';
                discountPrice = row[7];
                stock = row[8] || 'in_stock';
                // row[9] visible
                description = row[10] || `Genuine ${name} available at Sangeet Sarathi.`;
            }

            if (!name || typeof name !== 'string') continue;

            const docId = `imp_${id}_${Date.now()}`; // Unique ID

            const product = {
                id: docId,
                name: name.trim(),
                model: String(id),
                dealer: dealer ? String(dealer).trim() : 'Unknown',
                dealerPrice: dealerPrice ? String(dealerPrice) : '',
                discountPrice: discountPrice ? String(discountPrice) : '',
                category: category ? String(category).toLowerCase() : 'accessories',
                price: String(price),
                stockStatus: stock,
                visible: true,
                description: description,
                specs: ['Standard Quality'],
                images: ['https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?q=80&w=800&auto=format&fit=crop'] // Placeholder
            };

            const ref = doc(db, 'products', docId);
            batch.set(ref, product);
            processedItems.push(product);
            count++;
            batchCount++;

            // Commit every 400 items
            if (batchCount >= 400) {
                await batch.commit();
                batch = writeBatch(db);
                batchCount = 0;
            }
        }

        if (batchCount > 0) {
            await batch.commit();
        }

        return NextResponse.json({
            success: true,
            message: `Imported ${count} items.`,
            sample: processedItems.slice(0, 5)
        });

    } catch (error) {
        console.error("Import failed:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
