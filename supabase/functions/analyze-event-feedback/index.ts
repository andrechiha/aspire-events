// @ts-nocheck — Supabase Edge Functions run on Deno, not Node
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id, mode = "full" } = await req.json();
    if (!event_id) {
      return new Response(JSON.stringify({ error: "event_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured. Set it in Supabase Dashboard → Edge Functions → Secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("id, title, start_datetime, end_datetime")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: allMessages } = await supabase
      .from("event_messages")
      .select("message, message_type, created_at")
      .eq("event_id", event_id)
      .order("created_at", { ascending: true });

    const messages = (allMessages || []).filter(
      (m: any) => m.message && m.message.trim().length >= 2 && m.message_type === "text"
    );

    const startDt = new Date(event.start_datetime);
    const endDt = event.end_datetime ? new Date(event.end_datetime) : startDt;

    const beforeMessages: string[] = [];
    const afterMessages: string[] = [];
    const duringMessages: string[] = [];

    for (const m of messages) {
      const t = new Date(m.created_at);
      if (t < startDt) beforeMessages.push(m.message);
      else if (t > endDt) afterMessages.push(m.message);
      else duringMessages.push(m.message);
    }

    const sample = (arr: string[], max: number) =>
      arr.length <= max
        ? arr
        : arr.filter((_, i) => i % Math.ceil(arr.length / max) === 0).slice(0, max);

    if (mode === "expectations") {
      const targetMsgs = [...beforeMessages, ...duringMessages];
      if (targetMsgs.length === 0) {
        return new Response(
          JSON.stringify({ expectations_summary: "No pre-event messages found yet. Attendees haven't sent any messages before the event.", message_count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sampled = sample(targetMsgs, 300);
      const systemPrompt = `You are an expert event analyst. Analyze the pre-event chat messages from attendees and produce a JSON report about their EXPECTATIONS.

The event: "${event.title}"
Event date: ${event.start_datetime}

Produce this exact JSON:
{
  "expectations_summary": "3-5 sentence detailed summary of what attendees are expecting, hoping for, and excited about",
  "excitement_level": <integer 0-100>,
  "top_expectations": ["expectation 1", "expectation 2", ...],
  "concerns": ["concern 1", "concern 2", ...],
  "questions_asked": ["question 1", "question 2", ...],
  "top_topics": [{"topic": "name", "count": <mentions>}, ...]
}

Rules:
- Keep each list to 3-7 items
- top_topics should have 3-5 entries sorted by count desc
- Be insightful and detailed in the summary`;

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `=== PRE-EVENT MESSAGES (${targetMsgs.length} total) ===\n${sampled.join("\n")}` },
          ],
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return new Response(
          JSON.stringify({ error: "OpenAI API error", details: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const openaiData = await openaiRes.json();
      const content = openaiData.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);
      parsed.message_count = targetMsgs.length;
      parsed.mode = "expectations";

      const reportUpdate: any = {
        event_id,
        expectations_summary: parsed.expectations_summary || "",
        message_count: messages.length,
        generated_at: new Date().toISOString(),
      };
      if (parsed.top_topics) reportUpdate.top_topics = parsed.top_topics;

      await supabase.from("ai_event_reports").upsert(reportUpdate, { onConflict: "event_id" });

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (mode === "feedback") {
      const targetMsgs = afterMessages;
      if (targetMsgs.length === 0) {
        return new Response(
          JSON.stringify({ feedback_summary: "No post-event feedback messages found yet.", message_count: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const sampled = sample(targetMsgs, 300);
      const systemPrompt = `You are an expert event feedback analyst. Analyze the post-event chat messages from attendees and produce a JSON report about their FEEDBACK.

The event: "${event.title}"
Event date: ${event.start_datetime} to ${event.end_datetime || event.start_datetime}

Produce this exact JSON:
{
  "feedback_summary": "3-5 sentence detailed summary of attendee feedback after the event",
  "sentiment_score": <integer 0-100, 0=very negative, 50=neutral, 100=very positive>,
  "positives": ["positive point 1", "positive point 2", ...],
  "negatives": ["negative point 1", "negative point 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "top_topics": [{"topic": "name", "count": <mentions>}, ...]
}

Rules:
- Keep each list to 3-7 items
- top_topics should have 3-5 entries sorted by count desc
- Be insightful and detailed`;

      const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          temperature: 0.4,
          max_tokens: 1500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `=== POST-EVENT FEEDBACK (${targetMsgs.length} total) ===\n${sampled.join("\n")}` },
          ],
        }),
      });

      if (!openaiRes.ok) {
        const errText = await openaiRes.text();
        return new Response(
          JSON.stringify({ error: "OpenAI API error", details: errText }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const openaiData = await openaiRes.json();
      const content = openaiData.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content);
      parsed.message_count = targetMsgs.length;
      parsed.mode = "feedback";

      const reportUpdate: any = {
        event_id,
        feedback_summary: parsed.feedback_summary || "",
        sentiment_score: Math.min(100, Math.max(0, parseInt(parsed.sentiment_score) || 50)),
        positives: parsed.positives || [],
        negatives: parsed.negatives || [],
        suggestions: parsed.suggestions || [],
        message_count: messages.length,
        generated_at: new Date().toISOString(),
      };
      if (parsed.top_topics) reportUpdate.top_topics = parsed.top_topics;

      await supabase.from("ai_event_reports").upsert(reportUpdate, { onConflict: "event_id" });

      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // mode === "full" (legacy)
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ expectations_summary: "No messages to analyze.", feedback_summary: "No messages to analyze.", sentiment_score: 50, positives: [], negatives: [], suggestions: [], top_topics: [], message_count: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const beforeSampled = sample(beforeMessages, 200);
    const afterSampled = sample(afterMessages, 200);
    const duringSampled = sample(duringMessages, 200);

    const systemPrompt = `You are an expert event feedback analyst. Analyze the chat messages from an event's community chat and produce a structured report in JSON format.

The event: "${event.title}"
Event start: ${event.start_datetime}
Event end: ${event.end_datetime || event.start_datetime}

Produce this exact JSON schema:
{
  "expectations_summary": "2-3 sentence summary of what attendees expected/anticipated before the event",
  "feedback_summary": "2-3 sentence summary of post-event feedback and reactions",
  "sentiment_score": <integer 0-100>,
  "positives": ["positive point 1", ...],
  "negatives": ["negative point 1", ...],
  "suggestions": ["suggestion 1", ...],
  "top_topics": [{"topic": "name", "count": <mentions>}, ...]
}

Rules:
- Keep each list to 3-7 items max
- top_topics should have 3-5 entries sorted by count desc
- If a category has no messages, note that in the summary
- Be concise but insightful`;

    const userContent = [
      beforeSampled.length > 0
        ? `=== BEFORE EVENT (${beforeMessages.length} messages) ===\n${beforeSampled.join("\n")}`
        : "=== BEFORE EVENT ===\nNo pre-event messages.",
      duringSampled.length > 0
        ? `=== DURING EVENT (${duringMessages.length} messages) ===\n${duringSampled.join("\n")}`
        : "=== DURING EVENT ===\nNo messages during event.",
      afterSampled.length > 0
        ? `=== AFTER EVENT (${afterMessages.length} messages) ===\n${afterSampled.join("\n")}`
        : "=== AFTER EVENT ===\nNo post-event messages.",
    ].join("\n\n");

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.4,
        max_tokens: 1500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      return new Response(
        JSON.stringify({ error: "OpenAI API error", details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiRes.json();
    const content = openaiData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "Empty response from OpenAI" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const parsed = JSON.parse(content);
    const reportRow = {
      event_id,
      expectations_summary: parsed.expectations_summary || "",
      feedback_summary: parsed.feedback_summary || "",
      sentiment_score: Math.min(100, Math.max(0, parseInt(parsed.sentiment_score) || 50)),
      positives: parsed.positives || [],
      negatives: parsed.negatives || [],
      suggestions: parsed.suggestions || [],
      top_topics: parsed.top_topics || [],
      message_count: messages.length,
      generated_at: new Date().toISOString(),
    };

    const { data: saved, error: upsertErr } = await supabase
      .from("ai_event_reports")
      .upsert(reportRow, { onConflict: "event_id" })
      .select()
      .single();

    if (upsertErr) {
      return new Response(
        JSON.stringify({ error: "Failed to save report", details: upsertErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(saved), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
