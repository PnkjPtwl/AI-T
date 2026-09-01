import { getSupabase } from '../db/supabase'

export interface UsageLogItem {
  id: string
  created_at: string
  endpoint_name: string
  model_name: string
  prompt_tokens: number
  completion_tokens: number
  cost: number
  session_id?: string | null
  user_id?: string | null
}

const DEFAULT_INPUT_RATE = 0.0000006 // $0.60 per 1M tokens
const DEFAULT_OUTPUT_RATE = 0.0000006 // $0.60 per 1M tokens
const INITIAL_BALANCE = 4.43

/**
 * Helper to log Cerebras API usage and automatically deduct cost from balance.
 * Has seamless fallback to api_keys store if custom migration tables are not created.
 */
export const trackCerebrasUsage = async (
  inputTokens: number,
  outputTokens: number,
  callType: string,
  model: string,
  userId?: string,
  sessionId?: string
) => {
  try {
    const supabase = await getSupabase()
    const cost = (inputTokens * DEFAULT_INPUT_RATE) + (outputTokens * DEFAULT_OUTPUT_RATE)

    // Try primary table `api_usage_logs` & `api_costs`
    try {
      const { error: logErr } = await supabase.from('api_usage_logs').insert({
        user_id: userId || null,
        session_id: sessionId || null,
        call_type: callType,
        model: model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        total_cost: cost
      })

      if (!logErr) {
        const { data: currentCost } = await supabase
          .from('api_costs')
          .select('balance')
          .eq('provider', 'cerebras')
          .single()

        const currentBal = currentCost?.balance !== undefined ? Number(currentCost.balance) : INITIAL_BALANCE
        const newBalance = Math.max(0, currentBal - cost)

        await supabase
          .from('api_costs')
          .upsert({
            provider: 'cerebras',
            balance: newBalance,
            input_token_cost: DEFAULT_INPUT_RATE,
            output_token_cost: DEFAULT_OUTPUT_RATE,
            updated_at: new Date().toISOString()
          }, { onConflict: 'provider' })
        return
      }
    } catch (primaryErr) {
      // Table doesn't exist yet, proceed to api_keys fallback
    }

    // Fallback to storing stats in `api_keys` table
    const { data: existingEntry } = await supabase
      .from('api_keys')
      .select('key_value')
      .eq('key_name', 'CEREBRAS_USAGE_DATA')
      .single()

    let usageData: any = {
      balance: INITIAL_BALANCE,
      totalCost: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCalls: 0,
      sessionCosts: {},
      logs: []
    }

    if (existingEntry && existingEntry.key_value) {
      try {
        usageData = JSON.parse(existingEntry.key_value)
      } catch (e) {}
    }

    usageData.balance = Math.max(0, (usageData.balance ?? INITIAL_BALANCE) - cost)
    usageData.totalCost = (usageData.totalCost || 0) + cost
    usageData.totalInputTokens = (usageData.totalInputTokens || 0) + inputTokens
    usageData.totalOutputTokens = (usageData.totalOutputTokens || 0) + outputTokens
    usageData.totalCalls = (usageData.totalCalls || 0) + 1

    if (sessionId) {
      usageData.sessionCosts = usageData.sessionCosts || {}
      usageData.sessionCosts[sessionId] = (usageData.sessionCosts[sessionId] || 0) + cost
    }

    const newLog: UsageLogItem = {
      id: Math.random().toString(36).substring(2, 11),
      created_at: new Date().toISOString(),
      endpoint_name: callType,
      model_name: model,
      prompt_tokens: inputTokens,
      completion_tokens: outputTokens,
      cost: cost,
      session_id: sessionId || null,
      user_id: userId || null
    }

    usageData.logs = [newLog, ...(usageData.logs || [])].slice(0, 100)

    await supabase.from('api_keys').upsert({
      key_name: 'CEREBRAS_USAGE_DATA',
      key_value: JSON.stringify(usageData),
      updated_at: new Date().toISOString()
    }, { onConflict: 'key_name' })

  } catch (err) {
    console.error('[trackCerebrasUsage] Error tracking usage:', err)
  }
}
