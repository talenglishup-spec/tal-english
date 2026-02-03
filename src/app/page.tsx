'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function Home() {
  const [level, setLevel] = useState<string>('L0');

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '2.5rem',
      background: 'var(--color-bg)',
      color: 'var(--color-text-main)',
      padding: '2rem'
    }}>
      <div style={{ textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Football English</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>Select your level to start training</p>
      </div>

      <div style={{ display: 'flex', gap: '1rem', background: 'var(--color-surface)', padding: '0.5rem', borderRadius: 'var(--radius-lg)' }}>
        {['L0', 'L1'].map((l) => (
          <button
            key={l}
            onClick={() => setLevel(l)}
            style={{
              padding: '0.75rem 2rem',
              borderRadius: 'var(--radius-md)',
              background: level === l ? 'var(--color-primary)' : 'transparent',
              color: level === l ? 'white' : 'var(--color-text-muted)',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', maxWidth: '300px' }}>
        <Link
          href={`/train?level=${level}`}
          style={{
            padding: '1rem',
            background: 'var(--color-secondary)',
            color: 'white',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          Start Training
        </Link>
        <Link
          href="/admin"
          style={{
            padding: '1rem',
            background: 'var(--color-surface)',
            color: 'var(--color-text-main)',
            borderRadius: 'var(--radius-md)',
            fontWeight: '600',
            textAlign: 'center',
            border: '1px solid var(--color-border)'
          }}
        >
          Admin Dashboard
        </Link>
      </div>
    </main>
  );
}
