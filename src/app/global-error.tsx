'use client';

/**
 * Next.js global error boundary. Catches errors thrown in the root layout
 * itself (before `error.tsx` can handle them). Must include its own
 * `<html>` and `<body>` since the root layout errored.
 */

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[global-error]', { name: error.name, message: error.message, digest: error.digest, stack: error.stack });
  }, [error]);

  return (
    <html>
      <body style={{ padding: '2rem', fontFamily: 'system-ui' }}>
        <h2>Application error</h2>
        <p style={{ color: '#666' }}>The application failed to load. The error has been logged.</p>
        {error.digest && <p style={{ fontSize: '0.85rem', color: '#999' }}>Reference: {error.digest}</p>}
        <button onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>Reload</button>
      </body>
    </html>
  );
}
