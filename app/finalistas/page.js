'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getSupabase } from '@/lib/supabase';
import { PublicHeader, Loading, Photo } from '@/components/ui';
import Crown from '@/components/Crown';
import Icon from '@/components/Icon';
import { EVENT } from '@/lib/config';
import { shortName, mainPhoto } from '@/lib/utils';
import { useSettings } from '@/lib/useSettings';

const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

export default function FinalistasPage() {
  const [list, setList] = useState(null);
  const settings = useSettings();

  useEffect(() => {
    getSupabase().from('public_contestants').select('*').eq('is_finalist', true).order('first_name')
      .then(({ data }) => setList(data || []));
  }, []);

  return (
    <>
      <PublicHeader />
      <div className="pub-head">
        <Crown className="hero-crown" />
        <h1 className="pub-title gold-text">Las {EVENT.finalists} Finalistas</h1>
        <p className="serif">del {titleCase(`${EVENT.line1} ${EVENT.line2}`)}</p>
      </div>
      <div className="pub-wrap">
        {list === null ? <Loading /> : list.length === 0 ? (
          <div className="card empty">
            <p>Las finalistas aún no han sido anunciadas.</p>
            {settings?.voting_open && <Link href="/votar" className="btn btn-gold"><Icon name="heart" /> Ir a votar por tu favorita</Link>}
          </div>
        ) : (
          <div className="fgrid">
            {list.map((c) => (
              <div key={c.id} className="fcard">
                <Photo src={mainPhoto(c)} alt={shortName(c)} />
                <div className="fcard-name">{shortName(c)}</div>
                <div className="muted small">{c.state}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
