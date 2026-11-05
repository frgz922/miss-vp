'use client';
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './supabase';
import { CRITERIA, EVENT } from './config';

export function avgEval(ev) {
  return CRITERIA.reduce((a, c) => a + Number(ev[c.key] || 0), 0) / CRITERIA.length;
}

export function useStaffData() {
  const [state, setState] = useState({ loading: true, participants: [] });

  const load = useCallback(async () => {
    const sb = getSupabase();
    const [p, e, v, s] = await Promise.all([
      sb.from('profiles').select('*').eq('role', 'participant').order('created_at', { ascending: false }),
      sb.from('evaluations').select('*'),
      sb.rpc('vote_results'),
      sb.from('settings').select('*').eq('id', 1).single(),
    ]);
    const error = p.error || e.error || v.error || s.error;

    const votes = Object.fromEntries((v.data || []).map((x) => [x.participant_id, Number(x.votes)]));
    const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);
    const maxVotes = Math.max(0, ...Object.values(votes));
    const byP = {};
    (e.data || []).forEach((ev) => { (byP[ev.participant_id] ||= []).push(ev); });
    const w = EVENT.publicVoteWeight;

    const participants = (p.data || []).map((x) => {
      const evs = byP[x.id] || [];
      const juryAvg = evs.length ? evs.reduce((a, ev) => a + avgEval(ev), 0) / evs.length : null;
      const vcount = votes[x.id] || 0;
      const publicScore = maxVotes ? (vcount / maxVotes) * 10 : 0;
      const finalScore = juryAvg == null ? null : juryAvg * (1 - w) + publicScore * w;
      return { ...x, evaluations: evs, juryAvg, votes: vcount, publicScore, finalScore };
    });

    setState({
      loading: false,
      error: error?.message,
      participants,
      settings: s.data || {},
      totalVotes,
    });
  }, []);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}
