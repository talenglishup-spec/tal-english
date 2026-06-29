'use server';

import { getPlayer } from '@/utils/sheets';

export async function checkSubscription(player_id: string): Promise<{
  isActive: boolean
  plan: string | null
  until: string | null
}> {
  const player = await getPlayer(player_id)
  
  if (!player) return { isActive: false, plan: null, until: null }
  
  const now = new Date()
  const until = player.subscription_until ? new Date(player.subscription_until as string) : null
  
  const isActive = player.subscription_status === 'active' && 
                   until !== null && 
                   until > now

  return {
    isActive,
    plan: player.subscription_plan || null,
    until: player.subscription_until || null
  }
}
