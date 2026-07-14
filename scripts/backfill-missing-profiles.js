/**
 * 일회성 백필: auth.users엔 있지만 public.profiles 행이 없는 계정을 채운다.
 *
 * 원인: handle_new_user 트리거(migration 001)는 auth.users에 새로 INSERT되는
 * 계정에만 작동한다. 이 계정이 생성된 시점에 트리거가 아직 DB에 적용되지
 * 않았던 경우 profiles 행이 누락되며, push_subscriptions.player_id 등
 * profiles(id)를 참조하는 FK INSERT가 전부 실패한다.
 *
 * handle_new_user()와 동일한 로직으로 누락분만 채운다(ON CONFLICT DO NOTHING
 * — 이미 있는 행은 절대 건드리지 않음). 실행: node scripts/backfill-missing-profiles.js
 */
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
    const { data: usersData, error: uErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (uErr) throw uErr;

    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id');
    if (pErr) throw pErr;
    const existingIds = new Set(profiles.map(p => p.id));

    const orphans = usersData.users.filter(u => !existingIds.has(u.id));
    console.log(`누락된 profiles 행: ${orphans.length}개`);

    for (const u of orphans) {
        const meta = u.user_metadata || {};
        const row = {
            id: u.id,
            email: u.email || '',
            display_name: meta.full_name || meta.name || '풋볼러',
            avatar_url: meta.avatar_url || null,
        };
        const { error } = await supabase.from('profiles').insert(row);
        if (error) {
            console.error(`  ❌ ${u.id} (${u.email}) 실패:`, error.message);
        } else {
            console.log(`  ✅ ${u.id} (${u.email}) profiles 행 생성`);
        }
    }

    console.log('완료.');
}

main().catch(err => { console.error('백필 실패:', err.message); process.exit(1); });
