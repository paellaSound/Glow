import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'node:crypto';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { slug } = await req.json();
    if (!slug) {
      return NextResponse.json({ error: 'Slug is required' }, { status: 400 });
    }

    const appKey = process.env.KLIPY_APP_KEY || 'test_key';
    const customerId = crypto.createHash('md5').update(user.id).digest('hex');

    const url = `https://api.klipy.com/api/v1/${appKey}/gifs/share/${slug}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customer_id: customerId,
      }),
    });

    if (!res.ok) {
      console.warn('[klipy] Failed to report share for slug:', slug, res.status);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Klipy share reporting failed' }, { status: 500 });
  }
}
