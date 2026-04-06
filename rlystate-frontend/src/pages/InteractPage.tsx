import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

export const InteractPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositReady, setDepositReady] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);

  useEffect(() => {
    api(`/api/chat/${id}/history`)
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        if (data.some((m: any) => m.content.includes("DEAL ACCEPTED"))) {
          setDepositReady(true);
        }
      });
  }, [id]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);

    // Optimistic human update
    const optimisticHuman = { id: 'temp1', sender: 'HUMAN_BUYER', content: input };
    setMessages(prev => [...prev, optimisticHuman]);
    const currentInput = input;
    setInput('');

    try {
      const res = await api(`/api/chat/${id}/negotiate`, {
        method: 'POST',
        body: JSON.stringify({ userMessage: currentInput })
      });
      const data = await res.json();

      setMessages(prev => [
        ...prev,
        { id: Math.random().toString(), sender: 'BUYER_AGENT', content: data.buyerAgentMessage },
        { id: Math.random().toString(), sender: 'SELLER_AGENT', content: data.sellerAgentMessage }
      ]);

      if (data.depositReady) setDepositReady(true);
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const executeDeposit = async () => {
    setDepositLoading(true);
    setDepositError(null);
    try {
      const lastSeller = [...messages].reverse().find(m => m.sender === 'SELLER_AGENT');
      const match = lastSeller?.content.match(/\$([0-9,]+)/);
      const amount = match ? parseFloat(match[1].replace(',', '')) : 0;

      if (!match || amount <= 0) {
        setDepositError('Could not find a valid deal amount. Try sending one more message to confirm the price.');
        setDepositLoading(false);
        return;
      }

      const res = await api(`/api/transactions/simulate`, {
        method: 'POST',
        body: JSON.stringify({ listingId: id, amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deposit failed');
      navigate('/buying');
    } catch (err: any) {
      setDepositError(err.message);
    } finally {
      setDepositLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.5rem', marginBottom: '4px' }}>Agent Negotiation Room</h1>
          <p className="page-subtitle" style={{ fontSize: '0.8rem', margin: 0 }}>Listing: {id}</p>
        </div>
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '4px 8px' }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '20px' }}>
        {messages.filter(m => m.sender !== 'BUYER_AGENT').map(m => (
          <div key={m.id} style={{
            alignSelf: m.sender.includes("HUMAN") ? 'flex-end' : 'flex-start',
            backgroundColor: m.sender.includes("HUMAN") ? 'var(--accent)' : (m.sender === 'SELLER_AGENT' ? 'var(--bg-tertiary)' : 'rgba(94, 106, 210, 0.2)'),
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            border: m.sender.includes('AGENT') ? '1px solid rgba(255,255,255,0.1)' : 'none',
            maxWidth: '85%'
          }}>
            <span style={{ display: 'block', fontSize: '0.65rem', textTransform: 'uppercase', color: m.sender.includes('HUMAN') ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', marginBottom: '4px' }}>
              {m.sender.replace('_', ' ')}
            </span>
            <span style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{m.content.replace('DEAL ACCEPTED.', '').replace('DEAL ACCEPTED', '')}</span>
          </div>
        ))}
        {loading && <div style={{ color: 'var(--text-secondary)', alignSelf: 'flex-start', fontSize: '0.8rem' }}>AI Agents are negotiating...</div>}
      </div>

      {!depositReady ? (
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your raw offer..."
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            style={{ flex: 1, padding: '14px', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
          />
          <button onClick={sendMessage} disabled={loading} style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0 20px', borderRadius: 'var(--radius-lg)', border: 'none', fontWeight: 600 }}>
            Send
          </button>
        </div>
      ) : (
        <div style={{ marginTop: 'auto', padding: '16px', backgroundColor: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--positive)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--positive)', marginBottom: '8px' }}>Negotiation Successful!</h4>
          <button onClick={executeDeposit} disabled={depositLoading} style={{ backgroundColor: depositLoading ? 'grey' : 'var(--positive)', color: 'white', width: '100%', padding: '14px', borderRadius: 'var(--radius-sm)', border: 'none', fontWeight: 'bold', cursor: depositLoading ? 'not-allowed' : 'pointer' }}>
            {depositLoading ? 'Processing...' : 'Lock in Deal'}
          </button>
          {depositError && <div style={{ color: 'var(--negative)', fontSize: '0.8rem', marginTop: '8px' }}>{depositError}</div>}
        </div>
      )}
    </div>
  );
};
