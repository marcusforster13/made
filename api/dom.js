// Dom, o consultor do MADE: recebe o pedido do app e chama a API do Claude.
// A chave (ANTHROPIC_API_KEY) e o código de acesso (MADE_CODIGO) ficam só nas variáveis do Vercel.
import Anthropic from "@anthropic-ai/sdk";

export const config = { maxDuration: 60 };

const client = new Anthropic();

function montarMensagens(input, images) {
  const turnos = typeof input === "string" ? [{ role: "user", content: input }] : Array.isArray(input) ? input : [];
  // junta turnos seguidos do mesmo papel (o app pode mandar dois "user" em sequência)
  const msgs = [];
  for (const t of turnos) {
    const role = t?.role === "assistant" ? "assistant" : "user";
    const content = String(t?.content ?? "");
    if (!content.trim()) continue;
    const ult = msgs[msgs.length - 1];
    if (ult && ult.role === role) ult.content += "\n\n" + content;
    else msgs.push({ role, content });
  }
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return null;
  if (Array.isArray(images) && images.length) {
    const ult = msgs[msgs.length - 1];
    ult.content = [
      ...images.slice(0, 4).map((i) => ({ type: "image", source: { type: "base64", media_type: i.type, data: i.data } })),
      { type: "text", text: ult.content },
    ];
  }
  return msgs;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ia: !!process.env.ANTHROPIC_API_KEY && !!process.env.MADE_CODIGO });
  }
  if (req.method !== "POST") return res.status(405).json({ code: "invalid_request" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ code: "sampling_disabled", message: "Falta ANTHROPIC_API_KEY no Vercel" });
  if (!process.env.MADE_CODIGO || req.headers["x-made-codigo"] !== process.env.MADE_CODIGO) {
    return res.status(401).json({ code: "not_granted" });
  }

  const { input, images, tier, json } = req.body || {};
  const messages = montarMensagens(input, images);
  if (!messages) return res.status(400).json({ code: "invalid_request", message: "Pedido vazio" });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: tier === "quick" ? "low" : "medium" },
      // se o modelo recusar por engano, outro modelo responde no lugar
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      ...(json ? { system: "Responda somente com o JSON pedido, sem nenhum texto antes ou depois." } : {}),
      messages,
    });
    if (response.stop_reason === "refusal") return res.status(422).json({ code: "refused" });
    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    return res.status(200).json({ text, truncated: response.stop_reason === "max_tokens" });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ code: "rate_limited" });
    if (e instanceof Anthropic.AuthenticationError) return res.status(503).json({ code: "sampling_disabled", message: "Chave da API inválida" });
    if (e instanceof Anthropic.BadRequestError) return res.status(400).json({ code: "invalid_request", message: e.message });
    console.error(e);
    return res.status(502).json({ code: "upstream_error" });
  }
}
