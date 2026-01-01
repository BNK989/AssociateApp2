import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { GAME_CONFIG } from '@/lib/gameConfig';
import { calculateNextTurnUserId } from '@/lib/gameLogic';
import { getPostHogServer } from '@/app/posthog-server'; // We might need to move this or duplicate logic if it's not server-ready, but let's assume util usage or implement inline.
// Actually, calculateNextTurnUserId is in lib/gameLogic, let's verify if that file is clean for server usage. It usually is.


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
            // 1. Initialize Proposal
            const initialConfirmations = [user.id];
            const { error } = await supabase
                .from('games')
                .update({
                    solving_proposal_created_at: new Date().toISOString(),
                    solve_proposal_confirmations: initialConfirmations
                })
                .eq('id', gameId);
            if (error) throw error;

            // 2. Check for Immediate Auto-Approval (e.g. 1/1 players)
            // Get Active Players
            const { data: activePlayers } = await supabase
                .from('game_players')
                .select('user_id')
                .eq('game_id', gameId)
                .eq('has_left', false);

            const activePlayerIds = activePlayers?.map(p => p.user_id) || [];

            // Check if every active player is in the (initial) confirmations list
            const allConfirmed = activePlayerIds.length > 0 && activePlayerIds.every(id => initialConfirmations.includes(id));

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

                const posthog = getPostHogServer();
                if (posthog) {
                    const { count: messageCount } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('game_id', gameId)
                        .eq('type', 'text');


                    posthog.capture({
                        distinctId: user.id,
                        event: 'game_status_change',
                        properties: {
                            game_id: gameId,
                            status: 'solving',
                            messages_count: messageCount || 0
                        }
                    });
                    await posthog.flush();
                }
            }
        } else if (action === 'leave_game') {
            const { error: leaveError } = await supabase.rpc('player_leave_game', { p_game_id: gameId });
            if (leaveError) throw leaveError;
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

            const posthog = getPostHogServer();
            if (posthog) {

                posthog.capture({
                    distinctId: user.id,
                    event: 'game_status_change',
                    properties: {
                        game_id: gameId,
                        status: 'texting',
                        messages_count: 0
                    }
                });
                await posthog.flush();
            }

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
                // 1. Get Active Players
                const { data: activePlayers } = await supabase
                    .from('game_players')
                    .select('user_id')
                    .eq('game_id', gameId)
                    .eq('has_left', false);

                const activePlayerIds = activePlayers?.map(p => p.user_id) || [];

                // 2. Check if every active player is in the confirmations list
                // We use newConfirms (which includes current user)
                const allConfirmed = activePlayerIds.length > 0 && activePlayerIds.every(id => newConfirms.includes(id));

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

                    const posthog = getPostHogServer();
                    if (posthog) {
                        const { count: messageCount } = await supabase
                            .from('messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('game_id', gameId)
                            .eq('type', 'text');


                        posthog.capture({
                            distinctId: user.id,
                            event: 'game_status_change',
                            properties: {
                                game_id: gameId,
                                status: 'solving',
                                messages_count: messageCount || 0
                            }
                        });
                        await posthog.flush();
                    }
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

            // Rule: Must be Author OR Free For All OR Author Has Left
            let isAuthorLeft = false;
            if (!isAuthor && !isFreeForAll) {
                // Check if Author has left
                const { data: authorData } = await supabase
                    .from('game_players')
                    .select('has_left')
                    .eq('game_id', gameId)
                    .eq('user_id', targetMessage.user_id)
                    .single();

                if (authorData?.has_left) {
                    isAuthorLeft = true;
                } else {
                    console.warn(`[Security] User ${user.id} attempted to solve out of turn. Target Author: ${targetMessage.user_id}`);
                    return NextResponse.json({ error: 'Not your turn! Wait for Free-for-all.' }, { status: 403 });
                }
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

                let updatePayload = {
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

                    const posthog = getPostHogServer();
                    if (posthog) {
                        const { count: totalMessageCount } = await supabase
                            .from('messages')
                            .select('*', { count: 'exact', head: true })
                            .eq('game_id', gameId)
                            .eq('type', 'text');


                        posthog.capture({
                            distinctId: user.id,
                            event: 'game_status_change',
                            properties: {
                                game_id: gameId,
                                status: 'completed',
                                messages_count: totalMessageCount || 0
                            }
                        });
                        await posthog.flush();
                    }
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
                // Rate Limiting Logic
                const ip = request.headers.get('x-forwarded-for') || 'unknown';
                const userIp = Array.isArray(ip) ? ip[0] : ip;

                // Use Service Role client for rate limit checks
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
                        const apiKey = process.env.GEMINI_KEY || process.env.GEMINI_API_KEY;

                        if (apiKey) {
                            const modelsToTry = [
                                GAME_CONFIG.AI_HINT_MODEL,
                                GAME_CONFIG.AI_HINT_BACKUP_MODEL
                            ].filter(Boolean);

                            console.log(`[Hint Debug] Models to try: ${modelsToTry.join(', ')}`);

                            for (const modelId of modelsToTry) {
                                try {
                                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

                                    const prompt = `Give a short, cryptic but helpful single-sentence hint for the word or phrase: "${msg.content}". Do not use the word itself. Max 12 words.`;

                                    console.log(`[Hint Debug] Attempting model: ${modelId}`);
                                    // console.log(`[Hint Debug] Sending request to: ${url.replace(apiKey, 'HIDDEN')}...`);

                                    const geminiResponse = await fetch(url, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            contents: [{ parts: [{ text: prompt }] }]
                                        })
                                    });

                                    console.log(`[Hint Debug] ${modelId} Response Status: ${geminiResponse.status}`);

                                    if (geminiResponse.ok) {
                                        const data = await geminiResponse.json();
                                        console.log(`[Hint Debug] Response Data Preview:`, JSON.stringify(data).slice(0, 300));

                                        const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

                                        if (candidateText) {
                                            aiHint = candidateText;
                                            console.log(`[Hint Debug] Success with ${modelId}. Extracted Hint: "${aiHint}"`);

                                            // Track Usage
                                            await adminSupabase.from('api_usage').insert({
                                                user_id: user.id,
                                                game_id: gameId,
                                                endpoint: 'gemini-hint',
                                                model: modelId, // Log model if column exists, otherwise just log usage
                                                ip_hash: userIp
                                            });

                                            break; // Exit loop on success
                                        } else {
                                            console.warn(`[Hint Debug] ${modelId} returned valid JSON but no text content.`);
                                        }
                                    } else {
                                        const errorText = await geminiResponse.text();
                                        console.error(`[Hint Debug] ${modelId} Error Response:`, errorText);
                                        // Continue to next model
                                    }
                                } catch (innerErr) {
                                    console.error(`[Hint Debug] Exception with ${modelId}:`, innerErr);
                                }
                            }
                        } else {
                            console.error('[Hint Debug] CRITICAL: Missing GEMINI_KEY or GEMINI_API_KEY environment variable!');
                        }
                    } catch (e: any) {
                        console.error('[Hint Debug] Hint Exception:', e.toString());
                        if (e.cause) console.error('[Hint Debug] Cause:', e.cause);
                    }
                } else {
                    console.warn('[Hint Debug] Msg Content missing for targetId:', targetId);
                }

                // Fallback if AI failed
                if (!aiHint && msg?.content) {
                    aiHint = `It relates to "${msg.content.substring(0, 1)}..." (AI unavailable)`;
                }
            }

            const updatePayload: { hint_level: number; cipher_text: string; ai_hint?: string } = {
                hint_level: nextLevel,
                cipher_text: newCipherText
            };

            if (aiHint) {
                updatePayload.ai_hint = aiHint;
            }

            const { error } = await supabase.from('messages').update(updatePayload).eq('id', targetId);

            if (error) throw error;

            // Return the hint to client
            return NextResponse.json({ success: true, ai_hint: aiHint });
        } else if (action === 'give_up') {
            const { targetId, userId } = payload;

            // 1. Fetch Target Message
            const { data: targetMessage, error: targetError } = await supabase
                .from('messages')
                .select('*')
                .eq('id', targetId)
                .single();

            if (targetError || !targetMessage) {
                return NextResponse.json({ error: 'Target message not found' }, { status: 404 });
            }

            // 2. Update Message (0 points, solved)
            const { error: msgError } = await supabase.from('messages').update({
                is_solved: true,
                solved_by: userId,
                winner_points: 0,
                author_points: 0
            }).eq('id', targetId);
            if (msgError) throw msgError;

            // 3. Reset Player Stats
            await supabase.from('game_players').update({
                consecutive_correct_guesses: 0
            }).eq('game_id', gameId).eq('user_id', userId);

            // 4. Reset Team Stats
            await supabase.from('games').update({
                team_consecutive_correct: 0,
                fever_mode_remaining: 0
            }).eq('id', gameId);

            // 5. Check Completion
            const { count: unsolvedCount } = await supabase.from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('game_id', gameId)
                .eq('is_solved', false)
                .lt('strikes', 3);

            if (unsolvedCount === 0) {
                await supabase.from('games').update({ status: 'completed' }).eq('id', gameId);
                // Optional: PostHog event...
            } else {
                // Reset solving timer for next turn
                await supabase.from('games').update({ solving_started_at: new Date().toISOString() }).eq('id', gameId);
            }
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Action API Error:", err);
        const errorMessage = err?.message || (err instanceof Error ? err.message : 'Unknown error');
        // Include full error details if available (e.g. Supabase error hint/details)
        const errorDetails = err?.details || err?.hint || undefined;
        return NextResponse.json({ error: errorMessage, details: errorDetails }, { status: 500 });
    }
}
