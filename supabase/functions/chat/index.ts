import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const fallbackGroqKey = Deno.env.get("GROK_API_KEY");
  
  if (!geminiKey && !fallbackGroqKey) {
    return new Response(JSON.stringify({ error: "No API keys configured on server" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json() as { messages: {role: string; content: string}[]; systemPrompt?: string };
    const { messages, systemPrompt } = body;

    let responseText = "";

    try {
      if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

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
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
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
      responseText = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    } catch (gemErr: unknown) {
      const gemMsg = gemErr instanceof Error ? gemErr.message : String(gemErr);
      console.warn(`[chat] Gemini failed (${gemMsg}), trying Groq fallback`);
      
      if (!fallbackGroqKey) throw new Error("Gemini failed and no Groq key available: " + gemMsg);

      const groqMessages = [];
      if (systemPrompt) {
        groqMessages.push({ role: "system", content: systemPrompt });
      }
      for (const m of messages) {
        groqMessages.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
      }

      const qRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${fallbackGroqKey}` },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          max_tokens: 4096,
          messages: groqMessages
        })
      });

      if (!qRes.ok) {
        const errText = await qRes.text();
        throw new Error(`Groq ${qRes.status}: ${errText.substring(0, 200)}`);
      }

      const qJson = await qRes.json();
      responseText = qJson.choices[0].message.content;
    }

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
