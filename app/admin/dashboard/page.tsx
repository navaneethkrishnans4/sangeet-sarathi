'use client';

import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';

export default function AdminDashboard() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [products, setProducts] = useState<any[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Edit State
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [editingProduct, setEditingProduct] = useState<any | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleEditClick = (product: any) => {
        setEditingProduct({ ...product }); // Copy to avoid mutation reference issues
    };

    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingProduct) return;
        setIsSaving(true);
        try {
            const docRef = doc(db, "products", editingProduct.id);
            // Only update specific fields
            const updates = {
                name: editingProduct.name,
                model: editingProduct.model,
                price: editingProduct.price,
                category: editingProduct.category,
                stockStatus: editingProduct.stockStatus,
                visible: editingProduct.visible === 'true' || editingProduct.visible === true, // Handle string/bool mismatch from form
                // For images, descriptions etc, we keep them as is unless we add fields to modal.
                // Taking a simplified approach for now as permitted by UI space.
            };

            await updateDoc(docRef, updates);

            // Update local state
            setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...updates } : p));
            setEditingProduct(null);
            // alert("Product updated successfully!");
        } catch (error) {
            console.error("Update failed", error);
            alert("Failed to update product.");
        } finally {
            setIsSaving(false);
        }
    };

    // --- Excel Logic ---

    const downloadTemplate = () => {
        const template = [
            {
                ID: 'unique-id-001',
                Model: 'EX-001',
                Name: 'Example Guitar',
                Category: 'Strings',
                Price: '₹15,000',
                StockStatus: 'In Stock',
                Visible: 'TRUE',
                Description: 'Sample description here',
                Specs: 'Wood Body, Steel Strings',
                Images: 'https://example.com/img1.jpg, https://example.com/img2.jpg'
            }
        ];
        const ws = XLSX.utils.json_to_sheet(template);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Template");
        XLSX.writeFile(wb, "SangeetSarathi_Inventory_Template.xlsx");
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        const reader = new FileReader();

        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws);

                let count = 0;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                for (const row of (data as any[])) {
                    let docId = row.ID || row.id || row.Id;

                    if (!docId) {
                        docId = 'gen_' + Math.random().toString(36).substr(2, 9);
                    } else {
                        docId = String(docId).trim();
                    }

                    const rawImages = row.Images || row.images || '';
                    const imagesArray = rawImages.toString().split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0);

                    const rawVisible = row.Visible || row.visible;
                    const isVisible = String(rawVisible).toUpperCase() === 'TRUE';

                    const productData = {
                        model: row.Model || row.model || 'N/A',
                        name: row.Name || row.name || 'Unknown Product',
                        price: row.Price || row.price || '₹0',
                        category: row.Category ? row.Category.toLowerCase() : 'accessories',
                        stockStatus: normalizeStockStatus(row.StockStatus || row.stockStatus),
                        visible: isVisible,
                        images: imagesArray.length > 0 ? imagesArray : ['https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?q=80&w=800&auto=format&fit=crop'],
                        description: row.Description || 'Imported product',
                        specs: row.Specs ? row.Specs.split(',') : ['Standard Grade']
                    };

                    await setDoc(doc(db, "products", docId), productData, { merge: true });
                    count++;
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

    return (
        <main className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
                <h1 style={{ fontSize: '2.5rem' }}>Dashboard</h1>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={downloadTemplate} className="btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                        ⬇ Download Template
                    </button>
                    <label className="btn-primary" style={{ fontSize: '0.9rem', padding: '0.75rem 1.5rem', cursor: 'pointer', opacity: isUploading ? 0.7 : 1 }}>
                        {isUploading ? 'Uploading...' : '📁 Upload Excel Inventory'}
                        <input
                            type="file"
                            accept=".xlsx, .xls"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            disabled={isUploading}
                        />
                    </label>
                </div>
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
                                    <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Price</th>
                                    <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Status</th>
                                    <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Visibility</th>
                                    <th style={{ padding: '1rem', fontWeight: '600', fontSize: '0.9rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.length === 0 ? (
                                    <tr><td colSpan={7} style={{ padding: '2rem', textAlign: 'center' }}>No products found. Please upload Excel.</td></tr>
                                ) : products.map((p) => (
                                    <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '1rem', fontFamily: 'monospace', color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.id}</td>
                                        <td style={{ padding: '1rem', fontFamily: 'monospace', color: '#fff' }}>{p.model}</td>
                                        <td style={{ padding: '1rem' }}>{p.name}</td>
                                        <td style={{ padding: '1rem', fontFamily: 'var(--font-body)' }}>{p.price}</td>
                                        <td style={{ padding: '1rem' }}>
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
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{
                                                color: p.visible !== false ? '#10B981' : '#6B7280',
                                                fontSize: '0.8rem',
                                                fontWeight: '600'
                                            }}>
                                                {p.visible !== false ? 'VISIBLE' : 'HIDDEN'}
                                            </span>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <button
                                                onClick={() => handleEditClick(p)}
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

            {/* EDIT MODAL */}
            {editingProduct && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 100
                }}>
                    <form onSubmit={handleSaveEdit} className="glass-panel" style={{
                        borderRadius: '12px', padding: '2rem', width: '90%', maxWidth: '500px',
                        display: 'flex', flexDirection: 'column', gap: '1rem'
                    }}>
                        <h2 style={{ marginBottom: '0.5rem' }}>Edit Product</h2>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>ID: {editingProduct.id}</p>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <label>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Model</span>
                                <input
                                    type="text"
                                    required
                                    value={editingProduct.model}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, model: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                                />
                            </label>
                            <label>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Category</span>
                                <select
                                    value={editingProduct.category}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                                >
                                    <option value="strings">Strings</option>
                                    <option value="percussion">Percussion</option>
                                    <option value="keys">Keys</option>
                                    <option value="wind">Wind</option>
                                    <option value="accessories">Accessories</option>
                                </select>
                            </label>
                        </div>

                        <label>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Product Name</span>
                            <input
                                type="text"
                                required
                                value={editingProduct.name}
                                onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                                style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                            />
                        </label>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <label>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Price</span>
                                <input
                                    type="text"
                                    required
                                    value={editingProduct.price}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, price: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                                />
                            </label>
                            <label>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Status</span>
                                <select
                                    value={editingProduct.stockStatus}
                                    onChange={(e) => setEditingProduct({ ...editingProduct, stockStatus: e.target.value })}
                                    style={{ width: '100%', padding: '0.5rem', background: 'rgba(255,255,255,0.05)', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                                >
                                    <option value="in_stock">In Stock</option>
                                    <option value="out_of_stock">Out of Stock</option>
                                    <option value="on_order">On Order</option>
                                </select>
                            </label>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: '0.5rem 0' }}>
                            <input
                                type="checkbox"
                                checked={editingProduct.visible !== false}
                                onChange={(e) => setEditingProduct({ ...editingProduct, visible: e.target.checked })}
                            />
                            <span style={{ fontSize: '0.9rem' }}>Visible in Shop</span>
                        </label>

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                            <button
                                type="button"
                                onClick={() => setEditingProduct(null)}
                                className="btn-outline"
                                style={{ flex: 1 }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="btn-primary"
                                style={{ flex: 1, opacity: isSaving ? 0.7 : 1 }}
                            >
                                {isSaving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </main>
    );
}
