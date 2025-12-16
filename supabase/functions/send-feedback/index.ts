import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const ADMIN_EMAIL = Deno.env.get("ADMIN_EMAIL");

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        if (!RESEND_API_KEY || !ADMIN_EMAIL) {
            console.error("Missing RESEND_API_KEY or ADMIN_EMAIL");
            throw new Error("Missing configuration");
        }

        const { name, email, message, type } = await req.json();

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                from: "Feedback <onboarding@resend.dev>", // Or a verified domain
                to: [ADMIN_EMAIL],
                subject: `New Feedback: ${type}`,
                html: `
          <h1>New Feedback Received</h1>
          <p><strong>Type:</strong> ${type}</p>
          <p><strong>Name:</strong> ${name || "Anonymous"}</p>
          <p><strong>Email:</strong> ${email || "Not provided"}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="background: #f9f9f9; padding: 10px; border-left: 5px solid #ccc;">
            ${message}
          </blockquote>
        `,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            console.error("Resend Error:", data);
            throw new Error("Failed to send email");
        }

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 200,
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
            status: 400,
        });
    }
});
