import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured on server" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json() as { messages: {role: string; content: string}[]; systemPrompt?: string };
    const { messages, systemPrompt } = body;

    const contents = messages.map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));

    const reqBody: Record<string, unknown> = {
      contents,
      generationConfig: { maxOutputTokens: 4096 }
    };
    if (systemPrompt) reqBody.systemInstruction = { parts: [{ text: systemPrompt }] };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reqBody)
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini ${res.status}: ${errText.substring(0, 200)}`);
    }

    const json = await res.json();
    const response = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return new Response(JSON.stringify({ response }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
