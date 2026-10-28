'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push('/admin/dashboard');
        } catch (error) {
            console.error("Login failed", error);
            alert('Invalid credentials or authentication failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="container" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="glass-panel" style={{ padding: '3rem', width: '100%', maxWidth: '400px', borderRadius: '8px' }}>
                <h1 style={{ marginBottom: '2rem', textAlign: 'center' }}>Admin Access</h1>
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ width: '100%', padding: '0.8rem', background: '#222', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                            placeholder="admin@sangeet.com"
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ width: '100%', padding: '0.8rem', background: '#222', border: '1px solid #333', color: '#fff', borderRadius: '4px' }}
                            placeholder="admin123"
                        />
                    </div>
                    <button type="submit" disabled={isLoading} className="btn-primary" style={{ marginTop: '1rem', opacity: isLoading ? 0.7 : 1 }}>
                        {isLoading ? 'Authenticating...' : 'Login'}
                    </button>
                </form>
            </div>
        </main>
    );
}
