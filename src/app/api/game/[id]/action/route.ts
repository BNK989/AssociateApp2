import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
            const { targetId, isMatch, winnerPoints, authorPoints, type, consecutive, strikes } = payload;

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
                    author_id: type === 'STEAL' ? payload.targetUserId : null,
                    author_amount: type === 'STEAL' ? authorPoints : 0
                });
                if (rpcError) throw rpcError;

                // 3. Stats
                await supabase.from('game_players').update({
                    consecutive_correct_guesses: consecutive
                }).eq('game_id', gameId).eq('user_id', user.id);

                // 4. Game Team Stats
                // Need to fetch current game stats to increment safely? Or use rpc? 
                // For speed, strict increment via rpc is better but simple update works if low concurrency
                // We will trust the payload for now or do a quick fetch
                const { data: gameData } = await supabase.from('games').select('team_consecutive_correct, fever_mode_remaining').eq('id', gameId).single();

                if (gameData) {
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
                }

                // Check Completion
                const { count: unsolvedCount } = await supabase.from('messages')
                    .select('*', { count: 'exact', head: true })
                    .eq('game_id', gameId)
                    .eq('is_solved', false)
                    .lt('strikes', 3);

                if (unsolvedCount === 0) {
                    await supabase.from('games').update({ status: 'completed' }).eq('id', gameId);
                } else {
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
            const { targetId, nextLevel, newCipherText } = payload;

            // Verify not already hinted? (Optional, but good for safety)

            const { error } = await supabase.from('messages').update({
                hint_level: nextLevel,
                cipher_text: newCipherText
            }).eq('id', targetId);

            if (error) throw error;
        }

        return NextResponse.json({ success: true });

    } catch (err: any) {
        console.error("Action API Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
