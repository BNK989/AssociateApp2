import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Archive games (activity > 72h ago, not yet archived)
        // 72 hours = 3 days
        // const archiveThreshold = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString();
        // Using config values from DB could be ideal, but hardcoded matching gameConfig.ts provided in task is safe for now.
        // gameConfig says 72 hours.

        // Calculate timestamp for 72 hours ago
        const archiveDate = new Date();
        archiveDate.setHours(archiveDate.getHours() - 72);

        const { data: archivedGames, error: archiveError } = await supabase
            .from("games")
            .update({
                status: "archived",
                archived_at: new Date().toISOString()
            })
            .neq("status", "archived")
            .lte("last_activity_at", archiveDate.toISOString())
            .select("id");

        if (archiveError) {
            throw archiveError;
        }

        // 2. Delete games (archived > 7 days ago)
        const deleteDate = new Date();
        deleteDate.setDate(deleteDate.getDate() - 7);

        const { data: deletedGames, error: deleteError } = await supabase
            .from("games")
            .delete()
            .eq("status", "archived")
            .lte("archived_at", deleteDate.toISOString())
            .select("id");

        if (deleteError) {
            throw deleteError;
        }

        return new Response(
            JSON.stringify({
                archived: archivedGames?.length ?? 0,
                deleted: deletedGames?.length ?? 0,
                archivedIds: archivedGames?.map(g => g.id),
                deletedIds: deletedGames?.map(g => g.id)
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
                status: 200,
            }
        );
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
