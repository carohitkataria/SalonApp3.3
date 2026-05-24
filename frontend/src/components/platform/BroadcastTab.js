/**
 * Phase 6 (Part A) — Platform Admin Broadcast Tab.
 * In-app notifications fan-out to salon admins.
 */
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Loader2, Send, Megaphone, History, Users, Crown, Pause, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AUDIENCES = [
  { id: 'all_salons', label: 'All salons', icon: Users, hint: 'Active salons (premium + free)' },
  { id: 'premium_salons', label: 'Premium salons', icon: Crown, hint: 'Active paid / granted subscriptions' },
  { id: 'free_salons', label: 'Free salons', icon: Users, hint: 'No active premium subscription' },
  { id: 'suspended_salons', label: 'Suspended salons', icon: Pause, hint: 'Platform-suspended salons only' },
];

const fmtTs = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-IN'); } catch { return iso; }
};

export default function BroadcastTab({ headers }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all_salons');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const r = await axios.get(`${API}/platform/broadcasts`, { headers });
      setHistory(r.data?.broadcasts || []);
    } catch (e) {
      toast.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, [headers]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const send = async () => {
    if (!title.trim() || title.trim().length < 2) { toast.error('Title is required (min 2 chars)'); return; }
    if (!message.trim() || message.trim().length < 2) { toast.error('Message is required (min 2 chars)'); return; }
    setSending(true);
    try {
      const r = await axios.post(
        `${API}/platform/broadcast`,
        { title: title.trim(), message: message.trim(), audience, channels: ['in_app'] },
        { headers },
      );
      toast.success(`Sent to ${r.data?.delivered_count ?? 0}/${r.data?.target_count ?? 0} salons`);
      setTitle('');
      setMessage('');
      fetchHistory();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><Megaphone className="w-5 h-5 text-amber-400" /> Broadcast</h2>
          <p className="text-xs text-zinc-500">Send in-app announcements to salon admins.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Compose form */}
        <div className="lg:col-span-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Audience</label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {AUDIENCES.map(a => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setAudience(a.id)}
                  className={`text-left rounded-xl border p-3 transition-colors ${
                    audience === a.id
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-200'
                      : 'border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <a.icon className="w-4 h-4" /> {a.label}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-1">{a.hint}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="e.g., Festive offer this week!"
              className="mt-1 bg-zinc-950 border-zinc-800 text-white"
            />
            <div className="text-[10px] text-zinc-500 mt-1">{title.length}/140</div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="Compose a clear, helpful message..."
              className="mt-1 w-full bg-zinc-950 border border-zinc-800 text-white rounded-md p-3 text-sm focus:outline-none focus:border-amber-500/60"
            />
            <div className="text-[10px] text-zinc-500 mt-1">{message.length}/2000 · In-app notifications only (WhatsApp coming later)</div>
          </div>

          <div className="flex justify-end">
            <Button onClick={send} disabled={sending} className="bg-amber-500 hover:bg-amber-600 text-black font-bold">
              {sending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
              Send broadcast
            </Button>
          </div>
        </div>

        {/* History */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2"><History className="w-4 h-4 text-amber-400" /> Recent</h3>
            <Button size="sm" variant="outline" onClick={fetchHistory}>
              <RefreshCw className={`w-3 h-3 ${historyLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {historyLoading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-amber-400" /></div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 text-xs">No broadcasts yet.</div>
          ) : (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {history.map(b => (
                <div key={b.id} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="text-sm font-semibold text-white truncate">{b.title}</div>
                  <div className="text-xs text-zinc-400 mt-1 line-clamp-2">{b.message}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">{b.audience.replace('_', ' ')}</span>
                    <span className="text-[10px] text-zinc-500">{b.delivered_count}/{b.target_count} delivered</span>
                  </div>
                  <div className="text-[10px] text-zinc-600 mt-1">{fmtTs(b.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
