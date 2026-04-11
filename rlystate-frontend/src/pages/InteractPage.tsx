import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

interface Message {
  id: string;
  sender: string;
  content: string;
}

export const InteractPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const forceManual = searchParams.get('mode') === 'manual';
  const [messages, setMessages] = useState<Message[]>([]);
  const [convInfo, setConvInfo] = useState<{ autonomyMode: string; status: string } | null>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [depositReady, setDepositReady] = useState(false);
  const [depositLoading, setDepositLoading] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);
  const [declineError, setDeclineError] = useState<string | null>(null);
  const [confirmingDecline, setConfirmingDecline] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAuto = !forceManual && convInfo?.autonomyMode === 'autonomous';
  const isWalkedAway = convInfo?.status === 'walked_away';

  const fetchHistory = () => {
    api(`/api/chat/${id}/history`)
      .then(res => res.json())
      .then(data => {
        setMessages(data);
        if (data.some((m: Message) => m.content.includes('DEAL ACCEPTED'))) {
          setDepositReady(true);
        }
      });
  };

  const fetchInfo = () => {
    api(`/api/chat/${id}/info`)
      .then(res => res.json())
      .then(data => {
        if (data.autonomyMode) setConvInfo({ autonomyMode: data.autonomyMode, status: data.status });
        if (data.status === 'completed') setDepositReady(true);
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchHistory();
    fetchInfo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Poll every 15s for autonomous conversations or active ones
  useEffect(() => {
    if (isAuto) {
      const controller = new AbortController();
      intervalRef.current = setInterval(() => {
        fetchHistory();
        fetchInfo();
      }, 15000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        controller.abort();
      };
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isAuto]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);

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

      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== 'temp1'));
        setInput(currentInput);
        return;
      }

      setMessages(prev => [
        ...prev.filter(m => m.id !== 'temp1'),
        { id: Math.random().toString(), sender: 'HUMAN_BUYER', content: currentInput },
        { id: Math.random().toString(), sender: 'BUYER_AGENT', content: data.buyerAgentMessage },
        { id: Math.random().toString(), sender: 'SELLER_AGENT', content: data.sellerAgentMessage }
      ]);

      if (data.depositReady) setDepositReady(true);
    } catch {
      setMessages(prev => prev.filter(m => m.id !== 'temp1'));
      setInput(currentInput);
    } finally {
      setLoading(false);
    }
  };

  const executeDeposit = async () => {
    setDepositLoading(true);
    setDepositError(null);
    try {
      const lastSeller = [...messages].reverse().find(m => m.sender === 'SELLER_AGENT');
      // Prefer the amount on the DEAL ACCEPTED line; fall back to first dollar sign
      const match =
        lastSeller?.content.match(/DEAL ACCEPTED AT \$?([0-9,]+)/i) ??
        lastSeller?.content.match(/\$([0-9,]+)/);
      const amount = match ? parseFloat(match[1].replace(',', '')) : 0;

      if (!match || amount <= 0) {
        setDepositError('Could not find a valid deal amount. Try sending one more message to confirm the price.');
        setDepositLoading(false);
        return;
      }

      const res = await api('/api/transactions/simulate', {
        method: 'POST',
        body: JSON.stringify({ listingId: id, amount })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deposit failed');
      navigate('/profile');
    } catch (err: unknown) {
      setDepositError(err instanceof Error ? err.message : 'Deposit failed');
    } finally {
      setDepositLoading(false);
    }
  };

  const declineDeal = async () => {
    setDeclining(true);
    setDeclineError(null);
    setDepositError(null);
    try {
      const res = await api(`/api/chat/${id}/decline-deal`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        setDeclineError(data.error || 'Failed to decline deal.');
        setConfirmingDecline(false);
        return;
      }
      navigate('/buying');
    } catch {
      setDeclineError('Something went wrong. Please try again.');
      setConfirmingDecline(false);
    } finally {
      setDeclining(false);
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '1.4rem', marginBottom: 2 }}>Negotiation Room</h1>
          {isAuto && (
            <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: 'rgba(94,106,210,0.2)', color: 'var(--accent)', border: '1px solid rgba(94,106,210,0.3)', letterSpacing: '0.5px' }}>
              AI AGENT
            </span>
          )}
        </div>
        <button
          onClick={() => navigate('/buying')}
          style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.5rem', lineHeight: 1, padding: '4px 8px' }}
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20 }}>
        {messages.filter(m => m.sender !== 'BUYER_AGENT').map((m, i) => (
          <div key={m.id ?? i} style={{
            alignSelf: m.sender === 'HUMAN_BUYER' ? 'flex-end' : 'flex-start',
            backgroundColor: m.sender === 'HUMAN_BUYER' ? 'var(--accent)' : 'var(--bg-tertiary)',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: m.sender === 'SELLER_AGENT' ? '1px solid rgba(255,255,255,0.1)' : 'none',
            maxWidth: '82%'
          }}>
            <span style={{ display: 'block', fontSize: '0.6rem', textTransform: 'uppercase', color: m.sender === 'HUMAN_BUYER' ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)', marginBottom: 3 }}>
              {m.sender === 'SELLER_AGENT' ? 'Seller Agent' : 'You'}
            </span>
            <span style={{ fontSize: '0.875rem', lineHeight: 1.45 }}>
              {m.content.replace(/DEAL ACCEPTED[^.]*\./gi, '').trim() || m.content}
            </span>
          </div>
        ))}
        {loading && (
          <div style={{ color: 'var(--text-secondary)', alignSelf: 'flex-start', fontSize: '0.8rem' }}>Agents are negotiating...</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom area */}
      {depositReady ? (
        <div style={{ marginTop: 'auto', padding: 16, backgroundColor: 'rgba(16,185,129,0.1)', border: '1px solid var(--positive)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <h4 style={{ color: 'var(--positive)', marginBottom: 8 }}>Deal reached!</h4>
          <button
            onClick={executeDeposit}
            disabled={depositLoading || declining || confirmingDecline}
            style={{ backgroundColor: (depositLoading || confirmingDecline) ? 'grey' : 'var(--positive)', color: 'white', width: '100%', padding: 14, borderRadius: 'var(--radius-sm)', border: 'none', fontWeight: 700, cursor: (depositLoading || confirmingDecline) ? 'not-allowed' : 'pointer', marginBottom: 8 }}
          >
            {depositLoading ? 'Processing...' : 'Lock in Deal'}
          </button>
          {!confirmingDecline ? (
            <button
              onClick={() => setConfirmingDecline(true)}
              disabled={depositLoading || declining}
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', width: '100%', padding: 11, borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Decline Deal
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setConfirmingDecline(false)}
                disabled={declining}
                style={{ flex: 1, background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', padding: 11, borderRadius: 'var(--radius-sm)', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}
              >
                Keep Deal
              </button>
              <button
                onClick={declineDeal}
                disabled={declining}
                style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444', padding: 11, borderRadius: 'var(--radius-sm)', fontWeight: 700, cursor: declining ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}
              >
                {declining ? 'Declining...' : 'Yes, Decline'}
              </button>
            </div>
          )}
          {(depositError || declineError) && (
            <div style={{ color: 'var(--negative)', fontSize: '0.8rem', marginTop: 8 }}>{depositError || declineError}</div>
          )}
        </div>
      ) : isWalkedAway ? (
        <div style={{ marginTop: 'auto', padding: 14, backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>
            The agent wasn't able to reach a deal within your budget.
          </p>
          <button onClick={() => navigate('/search')} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-secondary)', padding: '8px 20px', borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
            Try another listing
          </button>
        </div>
      ) : isAuto ? (
        <div style={{ marginTop: 'auto', padding: 14, backgroundColor: 'var(--bg-secondary)', border: '1px solid rgba(94,106,210,0.2)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
            AI agent is negotiating on your behalf. You'll be notified when a deal is reached.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your offer..."
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            style={{ flex: 1, padding: 14, borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-tertiary)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontFamily: 'inherit' }}
          />
          <button onClick={sendMessage} disabled={loading} style={{ backgroundColor: 'var(--accent)', color: 'white', padding: '0 20px', borderRadius: 'var(--radius-lg)', border: 'none', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer' }}>
            Send
          </button>
        </div>
      )}
    </div>
  );
};
