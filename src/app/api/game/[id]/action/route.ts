import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { GAME_CONFIG } from '@/lib/gameConfig';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id: gameId } = await params;
    const cookieStore = await cookies();

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll() },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch { }
                },
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { action, payload } = body;

        console.log(`[API] Action received: ${action}`, JSON.stringify(payload || {}));

        if (action === 'propose_solve') {
            const { error } = await supabase
                .from('games')
                .update({
                    solving_proposal_created_at: new Date().toISOString(),
                    solve_proposal_confirmations: [user.id]
                })
                .eq('id', gameId);
            if (error) throw error;

        } else if (action === 'deny_solve') {
            const { error } = await supabase
                .from('games')
                .update({
                    solving_proposal_created_at: null,
                    solve_proposal_confirmations: []
                })
                .eq('id', gameId);
            if (error) throw error;

        } else if (action === 'reset_game') {
            // 1. Reset Game State
            const { error: gameError } = await supabase
                .from('games')
                .update({
                    status: 'texting',
                    solving_started_at: null,
                    solving_proposal_created_at: null,
                    solve_proposal_confirmations: [],
                    team_consecutive_correct: 0,
                    fever_mode_remaining: 0
                })
                .eq('id', gameId);
            if (gameError) throw gameError;

            // 2. Reset Messages
            const { error: msgError } = await supabase
                .from('messages')
                .update({
                    is_solved: false,
                    hint_level: 0,
                    ai_hint: null,
                    strikes: 0,
                    winner_points: 0,
                    author_points: 0,
                    solved_by: null
                })
                .eq('game_id', gameId);
            if (msgError) throw msgError;

            // 3. Reset Player Stats
            const { error: playerError } = await supabase
                .from('game_players')
                .update({
                    score: 0,
                    consecutive_correct_guesses: 0
                })
                .eq('game_id', gameId);
            if (playerError) throw playerError;

        } else if (action === 'confirm_solve') {
            // Logic repeated from client
            const { data: game } = await supabase.from('games').select('solve_proposal_confirmations').eq('id', gameId).single();
            if (!game) throw new Error("Game not found");

            // Prevent double confirmation logic is handled by adding to set, but array is simple
            const currentConfirms = game.solve_proposal_confirmations || [];
            if (!currentConfirms.includes(user.id)) {
                const newConfirms = [...currentConfirms, user.id];

                // Check if all players confirmed
                const { count } = await supabase.from('game_players').select('*', { count: 'exact', head: true }).eq('game_id', gameId);
                const allConfirmed = count ? newConfirms.length >= count : false;

                if (allConfirmed) {
                    await supabase
                        .from('games')
                        .update({
                            status: 'solving',
                            solving_proposal_created_at: null,
                            solve_proposal_confirmations: [],
                            solving_started_at: new Date().toISOString()
                        })
                        .eq('id', gameId);
                } else {
                    await supabase
                        .from('games')
                        .update({ solve_proposal_confirmations: newConfirms })
                        .eq('id', gameId);
                }
            }

        } else if (action === 'solve_attempt') {
            // Complex Solve Logic
            const { targetId, isMatch, winnerPoints, authorPoints, type, consecutive, strikes, targetUserId } = payload;

            // 1. Fetch Target Message to Validate
            const { data: targetMessage, error: targetError } = await supabase
                .from('messages')
                .select('*')
                .eq('id', targetId)
                .single();

            if (targetError || !targetMessage) {
                return NextResponse.json({ error: 'Target message not found' }, { status: 404 });
            }

            // 2. Fetch Game State for Timing
            const { data: gameData } = await supabase.from('games').select('*').eq('id', gameId).single();
            if (!gameData) return NextResponse.json({ error: 'Game not found' }, { status: 404 });

            // 3. STRICT TURN VALIDATION
            // Calculate if it's Free For All
            const solvingStartedAt = gameData.solving_started_at ? new Date(gameData.solving_started_at).getTime() : 0;
            const now = Date.now();
            const durationMs = (GAME_CONFIG.SOLVING_MODE_DURATION_SECONDS || 20) * 1000;
            const isFreeForAll = (now - solvingStartedAt) > durationMs;

            const isAuthor = targetMessage.user_id === user.id;

            // Rule: Must be Author OR Free For All
            if (!isAuthor && !isFreeForAll) {
                console.warn(`[Security] User ${user.id} attempted to solve out of turn. Target Author: ${targetMessage.user_id}`);
                return NextResponse.json({ error: 'Not your turn! Wait for Free-for-all.' }, { status: 403 });
            }

            if (isMatch) {
                // 1. Update Message
                const { error: msgError } = await supabase.from('messages').update({
                    is_solved: true,
                    solved_by: user.id,
                    winner_points: winnerPoints,
                    author_points: type === 'STEAL' ? authorPoints : 0
                }).eq('id', targetId);
                if (msgError) throw msgError;

                // 2. Distribute Points RPC
                const { error: rpcError } = await supabase.rpc('distribute_game_points', {
                    game_id_param: gameId,
                    winner_id: user.id,
                    winner_amount: winnerPoints,
                    author_id: type === 'STEAL' ? targetUserId : null,
                    author_amount: type === 'STEAL' ? authorPoints : 0
                });
                if (rpcError) throw rpcError;

                // 3. Stats
                await supabase.from('game_players').update({
                    consecutive_correct_guesses: consecutive
                }).eq('game_id', gameId).eq('user_id', user.id);

                // 4. Game Team Stats
                const newTeamConsec = (gameData.team_consecutive_correct || 0) + 1;
                const newFever = Math.max(0, (gameData.fever_mode_remaining || 0) - 1);

                let updatePayload: any = {
                    team_consecutive_correct: newTeamConsec,
                    fever_mode_remaining: newFever
                };

                if (newTeamConsec >= 5 && newFever === 0) {
                    updatePayload.fever_mode_remaining = 3;
                }

                await supabase.from('games').update(updatePayload).eq('id', gameId);

                // Check Completion
                const { count: unsolvedCount } = await supabase.from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', gameId)
                    .eq('is_solved', false)
                    .lt('strikes', 3);

                if (unsolvedCount === 0) {
                    await supabase.from('games').update({ status: 'completed' }).eq('id', gameId);
                } else {
                    // CRITICAL: Reset solving timer for NEXT turn
                    await supabase.from('games').update({ solving_started_at: new Date().toISOString() }).eq('id', gameId);
                }

            } else {
                // Wrong Guess
                const newStrikes = (strikes || 0) + 1;
                await supabase.from('messages').update({
                    strikes: newStrikes,
                    is_solved: newStrikes >= 3
                }).eq('id', targetId);

                await supabase.from('game_players').update({ consecutive_correct_guesses: 0 }).eq('game_id', gameId).eq('user_id', user.id);
                await supabase.from('games').update({
                    team_consecutive_correct: 0,
                    fever_mode_remaining: 0
                }).eq('id', gameId);
            }
        } else if (action === 'get_hint') {
            console.log(`[API] Processing get_hint action for matchId: ${gameId}`);
            const { targetId, nextLevel, newCipherText } = payload;
            let aiHint = null;

            // Level 3: AI Hint
            if (nextLevel === 3) {
                // *** Rate Limiting ***
                const ip = request.headers.get('x-forwarded-for') || 'unknown';
                const userIp = Array.isArray(ip) ? ip[0] : ip;

                // Use Service Role client for rate limit checks to bypass RLS (if we enable it on api_usage)
                // We fallback to standard client if no service key, but RLS might block it then.
                const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
                const adminSupabase = serviceKey
                    ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
                    : supabase;

                // 1. Check Player Game Limit
                const { count: playerGameCount } = await adminSupabase
                    .from('api_usage')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', gameId)
                    .eq('user_id', user.id)
                    .eq('endpoint', 'gemini-hint');

                // 2. Check IP Daily Limit
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { count: ipDailyCount } = await adminSupabase
                    .from('api_usage')
                    .select('*', { count: 'exact', head: true })
                    .eq('ip_hash', userIp)
                    .eq('endpoint', 'gemini-hint')
                    .gte('created_at', yesterday);

                if ((playerGameCount || 0) >= GAME_CONFIG.AI_HINT_LIMIT_PER_GAME_PLAYER) {
                    return NextResponse.json({ error: "Player hint limit reached for this game." }, { status: 429 });
                }
                if ((ipDailyCount || 0) >= GAME_CONFIG.AI_HINT_LIMIT_PER_IP_DAY) {
                    return NextResponse.json({ error: "Daily IP hint limit reached." }, { status: 429 });
                }

                // *** Proceed with Generation ***
                const { data: msg } = await supabase.from('messages').select('content').eq('id', targetId).single();
                if (msg?.content) {
                    try {
                        const apiKey = process.env.GEMINI_KEY;
                        console.log(`[Hint Debug] Key exists: ${!!apiKey}, Model: ${GAME_CONFIG.AI_HINT_MODEL}`);
                        if (apiKey) {
                            const prompt = `Give a short, cryptic but helpful single-sentence hint for the word or phrase: "${msg.content}". Do not use the word itself. Max 12 words.`;

                            const modelId = GAME_CONFIG.AI_HINT_MODEL;
                            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

                            console.log(`[Hint Debug] Sending request to: ${url.split('?')[0]}...`);
                            console.log(`[Hint Debug] Payload:`, JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }));

                            const geminiResponse = await fetch(url, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ parts: [{ text: prompt }] }]
                                })
                            });

                            console.log(`[Hint Debug] Response Status: ${geminiResponse.status}`);

                            if (geminiResponse.ok) {
                                const data = await geminiResponse.json();
                                console.log(`[Hint Debug] Response Data:`, JSON.stringify(data).slice(0, 200));
                                aiHint = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
                                console.log(`[Hint Debug] Extracted Hint: ${aiHint}`);

                                // Track Usage (using admin client to ensure insert works even if RLS somehow restricts)
                                await adminSupabase.from('api_usage').insert({
                                    user_id: user.id,
                                    game_id: gameId,
                                    endpoint: 'gemini-hint',
                                    ip_hash: userIp
                                });

                            } else {
                                const errorText = await geminiResponse.text();
                                console.error('[Hint Debug] Gemini API Error:', errorText);
                            }
                        } else {
                            console.error('[Hint Debug] Missing GEMINI_KEY env var');
                        }
                    } catch (e) {
                        console.error('[Hint Debug] Gemini Hint Gen Exception:', e);
                    }
                }
            }

            const updatePayload: any = {
                hint_level: nextLevel,
                cipher_text: newCipherText
            };

            if (aiHint) {
                updatePayload.ai_hint = aiHint;
            }

            const { error } = await supabase.from('messages').update(updatePayload).eq('id', targetId);

            if (error) throw error;
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Action API Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
