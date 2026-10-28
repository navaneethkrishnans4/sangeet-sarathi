'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { db, storage } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';

export default function AdminDashboard() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [products, setProducts] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [uploadTotal, setUploadTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [editingCell, setEditingCell] = useState<{ productId: string, fieldName: string } | null>(null);
    const [editingValue, setEditingValue] = useState<any>('');
    const router = useRouter();

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "products"));
            const fetched = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setProducts(fetched);
        } catch (error) {
            console.error("Error loading products:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // --- Actions ---

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return;
        try {
            await deleteDoc(doc(db, "products", id));
            setProducts(prev => prev.filter(p => p.id !== id));
        } catch (error) {
            console.error("Delete failed", error);
            alert("Failed to delete product.");
        }
    };

    const handleEditClick = (id: string) => {
        router.push(`/admin/products/${id}`);
    };

    const handleCellClick = (productId: string, fieldName: string, currentValue: any) => {
        setEditingCell({ productId, fieldName });
        setEditingValue(currentValue === undefined || currentValue === null ? '' : currentValue);
    };

    const handleInlineSave = async (productId: string, fieldName: string, value: any) => {
        // Optimistically update local state
        setProducts(prev => prev.map(p => {
            if (p.id === productId) {
                return { ...p, [fieldName]: value };
            }
            return p;
        }));

        setEditingCell(null);

        try {
            const docRef = doc(db, "products", productId);
            await updateDoc(docRef, { [fieldName]: value });
        } catch (error) {
            console.error("Failed to update product inline:", error);
            alert("Failed to save changes. Please try again.");
            // Revert state by fetching again
            fetchProducts();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, productId: string, fieldName: string) => {
        if (e.key === 'Enter') {
            handleInlineSave(productId, fieldName, editingValue);
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    // --- Excel Logic ---

    const downloadFullDatabase = () => {
        // Define headers
        const headers = [
            'ID', 'Model', 'Name', 'Category',
            'Dealer', 'Dealer Price', 'Selling Price', 'Discount Price',
            'Stock Status', 'Visible', 'Description', 'Image URL'
        ];

        // Map data
        const rows = products.map(p => [
            p.id,
            p.model,
            p.name,
            p.category,
            p.dealer || '',
            p.dealerPrice || '',
            p.price,
            p.discountPrice || '',
            p.stockStatus,
            p.visible ? 'TRUE' : 'FALSE',
            p.description,
            p.images[0] || ''
        ]);

        const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
        XLSX.writeFile(workbook, "SangeetSarathi_Full_Inventory.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadProgress(0);
        setUploadTotal(0);
        
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                const shouldReset = window.confirm("Do you want to CLEAR the database before importing? Click OK to reset the database, or Cancel to just update/merge existing products.");

                if (shouldReset) {
                    const snapshot = await getDocs(collection(db, "products"));
                    for (const d of snapshot.docs) {
                        await deleteDoc(d.ref);
                    }
                }

                const totalItems = data.length;
                setUploadTotal(totalItems);
                
                let count = 0;
                
                // Process in chunks to prevent UI freezing
                const chunkSize = 10;
                
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (let i = 0; i < totalItems; i += chunkSize) {
                    const chunk = (data as any[]).slice(i, i + chunkSize);
                    
                    // Process chunk concurrently for faster Firebase Storage checks
                    await Promise.all(chunk.map(async (row) => {
                        let docId = row.ID || row.id || row.Id;

                        if (!docId) {
                            docId = 'gen_' + Math.random().toString(36).substr(2, 9);
                        } else {
                            docId = String(docId).trim();
                        }

                        const rawImages = row.Images || row.images || '';
                        const imagesArray = rawImages.toString().split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

                        const rawVisible = row.Visible !== undefined ? row.Visible : row.visible;
                        let isVisible = true;
                        if (rawVisible !== undefined) {
                            isVisible = String(rawVisible).toUpperCase() === 'TRUE';
                        }

                        let rawKeywords = row.Keywords || row.keywords || row.Keyword || row.keyword || '';
                        let keywordsArray: string[] = [];
                        if (typeof rawKeywords === 'string') {
                            keywordsArray = rawKeywords.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
                        }

                        // Auto-restore images from Firebase Storage if not provided in Excel
                        let finalImages = imagesArray;
                        if (finalImages.length === 0) {
                            try {
                                const folderRef = ref(storage, `products/${docId}`);
                                const listResult = await listAll(folderRef);
                                if (listResult.items.length > 0) {
                                    const urls = await Promise.all(listResult.items.map(item => getDownloadURL(item)));
                                    finalImages = urls;
                                }
                            } catch (err) {
                                // Folder might not exist, ignore
                            }
                        }

                        const productData = {
                            model: row.Model || row.model || 'N/A',
                            name: row.Name || row.name || 'Unknown Product',
                            price: row.Price || row.price || '₹0',
                            category: row.Category ? String(row.Category).toLowerCase() : 'accessories',
                            stockStatus: normalizeStockStatus(row.StockStatus || row.stockStatus),
                            visible: isVisible,
                            images: finalImages.length > 0 ? finalImages : ['https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?q=80&w=800&auto=format&fit=crop'],
                            description: row.Description || 'Imported product',
                            specs: row.Specs ? String(row.Specs).split(',') : ['Standard Grade'],
                            keywords: keywordsArray
                        };

                        await setDoc(doc(db, "products", docId), productData, { merge: true });
                        count++;
                    }));
                    
                    setUploadProgress(Math.min(i + chunkSize, totalItems));
                }

                alert(`Processed ${count} products successfully!`);
                fetchProducts();
            } catch (error) {
                console.error("Upload failed", error);
                alert("Upload failed. Check console for details.");
            } finally {
                setIsUploading(false);
            }
        };

        reader.readAsBinaryString(file);
    };

    const normalizeStockStatus = (status: string) => {
        const s = status?.toLowerCase() || '';
        if (s.includes('out') || s === 'out_of_stock') return 'out_of_stock';
        if (s.includes('order') || s === 'on_order') return 'on_order';
        return 'in_stock';
    };

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

    return (
        <main className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <h1 style={{ fontSize: '2.5rem' }}>Dashboard</h1>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={downloadFullDatabase} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                        ⬇ Export Full DB
                    </button>
                    <label className="btn-primary" style={{ fontSize: '0.9rem', padding: '0.75rem 1.5rem', cursor: 'pointer', opacity: isUploading ? 0.7 : 1 }}>
                        {isUploading ? `Processing... ${uploadProgress}/${uploadTotal}` : '📁 Upload Excel Inventory'}
                        <input
                            type="file"
                            accept=".xlsx, .xls, .csv"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            disabled={isUploading}
                        />
                    </label>
                </div>
            </div>

            {isUploading && uploadTotal > 0 && (
                <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        <span>Importing database and restoring images...</span>
                        <span>{uploadProgress} / {uploadTotal}</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${(uploadProgress / uploadTotal) * 100}%`, height: '100%', background: 'var(--accent-gold)', transition: 'width 0.3s ease-out' }} />
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <input
                    type="text"
                    placeholder="Search instrument by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '4px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        background: 'rgba(0,0,0,0.2)',
                        color: '#fff',
                        width: '100%',
                        maxWidth: '400px',
                        fontSize: '1rem'
                    }}
                />
            </div>

            <div className="glass-panel" style={{ borderRadius: '8px', overflow: 'hidden' }}>
                {isLoading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading Firestore Data...</div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                            <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                                <tr>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>ID</th>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Model</th>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Product Name</th>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Dealer</th>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>MRP</th>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Discounted</th>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Visibility</th>
                                     <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProducts.length === 0 ? (
                                    <tr><td colSpan={9} style={{ padding: '2rem', textAlign: 'center' }}>No products found.</td></tr>
                                ) : filteredProducts.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.id}</td>
                                        
                                        {/* Model Cell */}
                                        <td 
                                            style={{ padding: '1rem', fontFamily: 'monospace', color: '#fff', cursor: 'pointer' }}
                                            onClick={() => handleCellClick(p.id, 'model', p.model)}
                                        >
                                            {editingCell?.productId === p.id && editingCell?.fieldName === 'model' ? (
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onBlur={() => handleInlineSave(p.id, 'model', editingValue)}
                                                    onKeyDown={(e) => handleKeyDown(e, p.id, 'model')}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    style={{
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid var(--accent-gold)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontFamily: 'monospace',
                                                        width: '100%'
                                                    }}
                                                />
                                            ) : (
                                                p.model
                                            )}
                                        </td>

                                        {/* Product Name Cell */}
                                        <td 
                                            style={{ padding: '1rem', cursor: 'pointer' }}
                                            onClick={() => handleCellClick(p.id, 'name', p.name)}
                                        >
                                            {editingCell?.productId === p.id && editingCell?.fieldName === 'name' ? (
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onBlur={() => handleInlineSave(p.id, 'name', editingValue)}
                                                    onKeyDown={(e) => handleKeyDown(e, p.id, 'name')}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    style={{
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid var(--accent-gold)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        width: '100%'
                                                    }}
                                                />
                                            ) : (
                                                p.name
                                            )}
                                        </td>

                                        {/* Dealer Cell */}
                                        <td 
                                            style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer' }}
                                            onClick={() => handleCellClick(p.id, 'dealer', p.dealer)}
                                        >
                                            {editingCell?.productId === p.id && editingCell?.fieldName === 'dealer' ? (
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onBlur={() => handleInlineSave(p.id, 'dealer', editingValue)}
                                                    onKeyDown={(e) => handleKeyDown(e, p.id, 'dealer')}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    style={{
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid var(--accent-gold)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        width: '100%',
                                                        fontSize: '0.8rem'
                                                    }}
                                                />
                                            ) : (
                                                p.dealer || '-'
                                            )}
                                        </td>

                                        {/* MRP (Price) Cell */}
                                        <td 
                                            style={{ padding: '1rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                                            onClick={() => handleCellClick(p.id, 'price', p.price)}
                                        >
                                            {editingCell?.productId === p.id && editingCell?.fieldName === 'price' ? (
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onBlur={() => handleInlineSave(p.id, 'price', editingValue)}
                                                    onKeyDown={(e) => handleKeyDown(e, p.id, 'price')}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    style={{
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid var(--accent-gold)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        width: '80px',
                                                        fontFamily: 'var(--font-body)'
                                                    }}
                                                />
                                            ) : (
                                                p.price
                                            )}
                                        </td>

                                        {/* Discounted Price Cell */}
                                        <td 
                                            style={{ padding: '1rem', fontFamily: 'var(--font-body)', cursor: 'pointer', color: 'var(--accent-gold)' }}
                                            onClick={() => handleCellClick(p.id, 'discountPrice', p.discountPrice)}
                                        >
                                            {editingCell?.productId === p.id && editingCell?.fieldName === 'discountPrice' ? (
                                                <input
                                                    type="text"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    onBlur={() => handleInlineSave(p.id, 'discountPrice', editingValue)}
                                                    onKeyDown={(e) => handleKeyDown(e, p.id, 'discountPrice')}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    style={{
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid var(--accent-gold)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        width: '80px',
                                                        fontFamily: 'var(--font-body)'
                                                    }}
                                                />
                                            ) : (
                                                p.discountPrice || '-'
                                            )}
                                        </td>

                                        {/* Stock Status Cell */}
                                        <td 
                                            style={{ padding: '1rem', cursor: 'pointer' }}
                                            onClick={() => handleCellClick(p.id, 'stockStatus', p.stockStatus)}
                                        >
                                            {editingCell?.productId === p.id && editingCell?.fieldName === 'stockStatus' ? (
                                                <select
                                                    value={editingValue}
                                                    onChange={(e) => handleInlineSave(p.id, 'stockStatus', e.target.value)}
                                                    onBlur={() => setEditingCell(null)}
                                                    onKeyDown={(e) => handleKeyDown(e, p.id, 'stockStatus')}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    style={{
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid var(--accent-gold)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    <option value="in_stock">In Stock</option>
                                                    <option value="out_of_stock">Out of Stock</option>
                                                    <option value="on_order">On Order</option>
                                                </select>
                                            ) : (
                                                <span style={{
                                                    background: p.stockStatus === 'in_stock' ? 'rgba(16, 185, 129, 0.2)' :
                                                        p.stockStatus === 'on_order' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                                    color: p.stockStatus === 'in_stock' ? '#10B981' :
                                                        p.stockStatus === 'on_order' ? '#F59E0B' : '#EF4444',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px',
                                                    fontSize: '0.8rem'
                                                }}>
                                                    {p.stockStatus === 'in_stock' ? 'In Stock' :
                                                        p.stockStatus === 'on_order' ? 'On Order' : 'Out of Stock'}
                                                </span>
                                            )}
                                        </td>

                                        {/* Visibility Cell */}
                                        <td 
                                            style={{ padding: '1rem', cursor: 'pointer' }}
                                            onClick={() => handleCellClick(p.id, 'visible', p.visible !== false)}
                                        >
                                            {editingCell?.productId === p.id && editingCell?.fieldName === 'visible' ? (
                                                <select
                                                    value={editingValue ? 'true' : 'false'}
                                                    onChange={(e) => handleInlineSave(p.id, 'visible', e.target.value === 'true')}
                                                    onBlur={() => setEditingCell(null)}
                                                    onKeyDown={(e) => handleKeyDown(e, p.id, 'visible')}
                                                    onClick={(e) => e.stopPropagation()}
                                                    autoFocus
                                                    style={{
                                                        background: '#111',
                                                        color: '#fff',
                                                        border: '1px solid var(--accent-gold)',
                                                        padding: '0.25rem 0.5rem',
                                                        borderRadius: '4px',
                                                        fontSize: '0.8rem'
                                                    }}
                                                >
                                                    <option value="true">Visible</option>
                                                    <option value="false">Hidden</option>
                                                </select>
                                            ) : (
                                                <span style={{
                                                    color: p.visible !== false ? '#10B981' : '#6B7280',
                                                    fontSize: '0.8rem',
                                                    fontWeight: '600'
                                                }}>
                                                    {p.visible !== false ? 'VISIBLE' : 'HIDDEN'}
                                                </span>
                                            )}
                                        </td>

                                        <td style={{ padding: '1rem' }}>
                                            <button
                                                onClick={() => handleEditClick(p.id)}
                                                style={{ marginRight: '1rem', background: 'none', border: 'none', color: 'var(--accent-gold)', cursor: 'pointer' }}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                onClick={() => handleDelete(p.id)}
                                                style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer' }}
                                            >
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
}
