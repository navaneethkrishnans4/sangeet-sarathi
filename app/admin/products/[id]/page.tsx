'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import Image from 'next/image';
import imageCompression from 'browser-image-compression';

export default function EditProductPage() {
    const router = useRouter();
    const params = useParams();
    const productId = params?.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [model, setModel] = useState('');
    const [price, setPrice] = useState('');
    const [discountPrice, setDiscountPrice] = useState('');
    const [category, setCategory] = useState('accessories');
    const [stockStatus, setStockStatus] = useState('in_stock');
    const [visible, setVisible] = useState(true);
    const [description, setDescription] = useState('');
    const [specs, setSpecs] = useState('');
    const [keywords, setKeywords] = useState('');
    
    const [images, setImages] = useState<string[]>([]);
    
    // Upload state
    const [uploadingImage, setUploadingImage] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    useEffect(() => {
        if (!productId) return;
        const fetchProduct = async () => {
            try {
                const docRef = doc(db, "products", productId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setName(data.name || '');
                    setModel(data.model || '');
                    setPrice(data.price || '');
                    setDiscountPrice(data.discountPrice || '');
                    setCategory(data.category || 'accessories');
                    setStockStatus(data.stockStatus || 'in_stock');
                    setVisible(data.visible !== false);
                    setDescription(data.description || '');
                    setSpecs((data.specs || []).join(', '));
                    setKeywords((data.keywords || []).join(', '));
                    
                    let imgArray = [];
                    if (Array.isArray(data.images)) {
                        imgArray = data.images;
                    } else if (typeof data.images === 'string') {
                        imgArray = data.images.split(',').map((s:string) => s.trim()).filter((s:string) => s.length > 0);
                    } else if (data.image) {
                        imgArray = [data.image];
                    }
                    setImages(imgArray);
                } else {
                    setError("Product not found");
                }
            } catch (err) {
                console.error("Error fetching product:", err);
                setError("Failed to load product");
            } finally {
                setIsLoading(false);
            }
        };
        fetchProduct();
    }, [productId]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const docRef = doc(db, "products", productId);
            const specsArray = specs.split(',').map(s => s.trim()).filter(s => s.length > 0);
            const keywordsArray = keywords.split(',').map(s => s.trim()).filter(s => s.length > 0);
            
            await updateDoc(docRef, {
                name,
                model,
                price,
                discountPrice,
                category,
                stockStatus,
                visible,
                description,
                specs: specsArray,
                keywords: keywordsArray,
                images: images
            });
            alert("Product updated successfully!");
            router.push('/admin/dashboard');
        } catch (err) {
            console.error("Update failed", err);
            alert("Failed to update product");
        } finally {
            setIsSaving(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        
        setUploadingImage(true);
        setUploadProgress(0);

        const newUrls: string[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const rawFile = files[i];

                // ── Compress before upload ──────────────────────────────
                let file: File;
                try {
                    file = await imageCompression(rawFile, {
                        maxSizeMB: 1,
                        maxWidthOrHeight: 1920,
                        useWebWorker: true,
                        fileType: 'image/webp',
                        initialQuality: 0.85,
                        onProgress: (pct) => {
                            // Show compression progress for this file
                            const overall = ((i * 100) + pct * 0.5) / files.length;
                            setUploadProgress(overall);
                        },
                    });
                } catch {
                    // If compression fails for any reason, fall back to original
                    file = rawFile;
                }
                // ────────────────────────────────────────────────────────

                const ext = file.type === 'image/webp' ? 'webp' : rawFile.name.split('.').pop();
                const uniqueName = `${Date.now()}_${i}.${ext}`;
                const storageRef = ref(storage, `products/${productId}/${uniqueName}`);

                const uploadTask = uploadBytesResumable(storageRef, file);

                // Wait for upload to complete
                await new Promise<void>((resolve, reject) => {
                    uploadTask.on(
                        'state_changed',
                        (snapshot) => {
                            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                            // Approximate progress for multiple files
                            const overallProgress = ((i * 100) + progress) / files.length;
                            setUploadProgress(overallProgress);
                        },
                        (error) => reject(error),
                        async () => {
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                            newUrls.push(downloadURL);
                            resolve();
                        }
                    );
                });
            }

            setImages(prev => [...prev, ...newUrls]);
        } catch (err) {
            console.error("Upload failed", err);
            alert("Image upload failed");
        } finally {
            setUploadingImage(false);
            setUploadProgress(0);
            // Reset input
            if (e.target) e.target.value = '';
        }
    };

    const removeImage = async (indexToRemove: number) => {
        const urlToRemove = images[indexToRemove];
        
        // Optimistically remove from UI
        setImages(prev => prev.filter((_, i) => i !== indexToRemove));

        // Optionally attempt to delete from storage if it's a firebase storage URL
        if (urlToRemove.includes('firebasestorage.googleapis.com')) {
            try {
                // Extract path from URL (very basic extraction)
                // A better approach is to store a map of path: url in firestore, but this works for simple urls
                // Or simply rely on the fact that we don't strictly need to delete from storage immediately
                // We'll leave the file in storage for safety in this simple implementation unless requested.
                // However, user requested to not consume too much space.
                const decodedUrl = decodeURIComponent(urlToRemove);
                const pathStart = decodedUrl.indexOf('/o/') + 3;
                const pathEnd = decodedUrl.indexOf('?alt=media');
                if (pathStart > 2 && pathEnd > pathStart) {
                    const filePath = decodedUrl.substring(pathStart, pathEnd);
                    const fileRef = ref(storage, filePath);
                    await deleteObject(fileRef);
                    console.log("Deleted from storage:", filePath);
                }
            } catch (err) {
                console.error("Failed to delete from storage", err);
                // We don't alert here because it was successfully removed from the UI array
            }
        }
    };

    const makeCoverPhoto = (index: number) => {
        if (index === 0) return;
        const newImages = [...images];
        const [selected] = newImages.splice(index, 1);
        newImages.unshift(selected);
        setImages(newImages);
    };

    if (isLoading) {
        return <div className="container" style={{ paddingTop: '8rem', textAlign: 'center' }}>Loading product...</div>;
    }

    if (error) {
        return <div className="container" style={{ paddingTop: '8rem', textAlign: 'center', color: '#EF4444' }}>{error}</div>;
    }

    return (
        <main className="container" style={{ paddingTop: '8rem', paddingBottom: '4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <button onClick={() => router.push('/admin/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        ← Back to Dashboard
                    </button>
                    <h1 style={{ fontSize: '2.5rem' }}>Edit Product</h1>
                    <p style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>ID: {productId}</p>
                </div>
            </div>

            <form onSubmit={handleSave} style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '2rem', alignItems: 'start' }}>
                {/* Main details column */}
                <div className="glass-panel" style={{ borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '0.5rem' }}>General Information</h2>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <label>
                            <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Product Name</span>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }}
                            />
                        </label>
                        <label>
                            <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Model</span>
                            <input
                                type="text"
                                required
                                value={model}
                                onChange={(e) => setModel(e.target.value)}
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }}
                            />
                        </label>
                    </div>

                    <label>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Description</span>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={4}
                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', resize: 'vertical' }}
                        />
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <label>
                            <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Specifications (comma separated)</span>
                            <input
                                type="text"
                                value={specs}
                                onChange={(e) => setSpecs(e.target.value)}
                                placeholder="Solid spruce top, Rosewood back, 24 frets"
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }}
                            />
                        </label>
                        <label>
                            <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Keywords (comma separated)</span>
                            <input
                                type="text"
                                value={keywords}
                                onChange={(e) => setKeywords(e.target.value)}
                                placeholder="tabla, thabla, tabala, indian drum"
                                style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }}
                            />
                        </label>
                    </div>
                    
                    <h2 style={{ fontSize: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginTop: '1rem', marginBottom: '0.5rem' }}>Media Gallery</h2>
                    
                    <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1.5rem', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Product Images (1st is cover)</span>
                            <label className="btn-outline" style={{ fontSize: '0.8rem', cursor: 'pointer', opacity: uploadingImage ? 0.5 : 1 }}>
                                {uploadingImage
                                    ? (uploadProgress < 50
                                        ? `Compressing… ${Math.round(uploadProgress * 2)}%`
                                        : `Uploading… ${Math.round((uploadProgress - 50) * 2)}%`)
                                    : '+ Upload Images'}
                                <input 
                                    type="file" 
                                    multiple 
                                    accept="image/*" 
                                    style={{ display: 'none' }} 
                                    onChange={handleFileUpload}
                                    disabled={uploadingImage}
                                />
                            </label>
                        </div>
                        
                        {images.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                No images uploaded yet.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem' }}>
                                {images.map((url, idx) => (
                                    <div key={idx} style={{ position: 'relative', aspectRatio: '1', borderRadius: '6px', overflow: 'hidden', border: idx === 0 ? '2px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.1)' }}>
                                        <Image src={url} alt={`Preview ${idx}`} fill style={{ objectFit: 'cover' }} unoptimized />
                                        
                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', opacity: 0, transition: 'opacity 0.2s', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }} 
                                             onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                             onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}>
                                            {idx !== 0 && (
                                                <button type="button" onClick={() => makeCoverPhoto(idx)} style={{ background: 'rgba(0,0,0,0.8)', border: '1px solid #fff', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                                                    Set Cover
                                                </button>
                                            )}
                                            <button type="button" onClick={() => removeImage(idx)} style={{ background: '#EF4444', border: 'none', color: '#fff', fontSize: '0.7rem', padding: '0.2rem 0.5rem', borderRadius: '4px', cursor: 'pointer' }}>
                                                Delete
                                            </button>
                                        </div>
                                        {idx === 0 && (
                                            <div style={{ position: 'absolute', bottom: '4px', left: '50%', transform: 'translateX(-50%)', background: 'var(--accent-gold)', color: '#000', fontSize: '0.6rem', padding: '0.1rem 0.4rem', borderRadius: '10px', fontWeight: 'bold' }}>COVER</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Sidebar controls */}
                <div className="glass-panel" style={{ borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'sticky', top: '6rem' }}>
                    <h2 style={{ fontSize: '1.2rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>Publish Settings</h2>

                    <label>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>MRP</span>
                        <input
                            type="text"
                            required
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 'bold' }}
                        />
                    </label>

                    <label>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Discounted Amount</span>
                        <input
                            type="text"
                            value={discountPrice}
                            onChange={(e) => setDiscountPrice(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px', fontSize: '1.1rem', fontWeight: 'bold' }}
                        />
                    </label>

                    <label>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Category</span>
                        <select
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }}
                        >
                            <option value="strings">Strings</option>
                            <option value="percussion">Percussion</option>
                            <option value="keys">Keys</option>
                            <option value="wind">Wind</option>
                            <option value="accessories">Accessories</option>
                        </select>
                    </label>

                    <label>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Stock Status</span>
                        <select
                            value={stockStatus}
                            onChange={(e) => setStockStatus(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', background: '#111', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', borderRadius: '6px' }}
                        >
                            <option value="in_stock">In Stock</option>
                            <option value="out_of_stock">Out of Stock</option>
                            <option value="on_order">On Order</option>
                        </select>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.5rem 0' }}>
                        <input
                            type="checkbox"
                            checked={visible}
                            onChange={(e) => setVisible(e.target.checked)}
                            style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--accent-gold)' }}
                        />
                        <span style={{ fontSize: '1rem' }}>Visible to Public</span>
                    </label>

                    <div style={{ marginTop: '1rem' }}>
                        <button
                            type="submit"
                            disabled={isSaving || uploadingImage}
                            className="btn-primary"
                            style={{ width: '100%', padding: '1rem', fontSize: '1rem', opacity: (isSaving || uploadingImage) ? 0.7 : 1 }}
                        >
                            {isSaving ? 'Saving Changes...' : 'Save Product'}
                        </button>
                    </div>
                </div>
            </form>
        </main>
    );
}
