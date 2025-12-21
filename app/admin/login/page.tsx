'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const router = useRouter();

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Mock login logic
        if (email === 'admin@sangeet.com' && password === 'admin123') {
            // Set cookie or local storage in real app
            router.push('/admin/dashboard');
        } else {
            alert('Invalid credentials');
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
                    <button type="submit" className="btn-primary" style={{ marginTop: '1rem' }}>
                        Login
                    </button>
                </form>
            </div>
        </main>
    );
}
