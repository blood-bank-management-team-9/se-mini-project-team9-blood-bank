import { useEffect, useState } from 'react';
import { getHealth } from '../services/api.js';

export default function Home() {
  const [status, setStatus] = useState('checking...');
  useEffect(() => {
    getHealth().then(() => setStatus('connected')).catch(() => setStatus('unreachable'));
  }, []);
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem' }}>
      <h1>Blood Bank Management</h1>
      <p>API status: {status}</p>
    </main>
  );
}
