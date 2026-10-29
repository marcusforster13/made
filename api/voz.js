// Voz do Dom: transforma a resposta em áudio com o ElevenLabs.
// Variáveis no Vercel: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID e, opcional, ELEVENLABS_MODEL.
export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  const pronto = !!process.env.ELEVENLABS_API_KEY && !!process.env.ELEVENLABS_VOICE_ID && !!process.env.MADE_CODIGO;
  if (req.method === "GET") return res.status(200).json({ ok: pronto });
  if (req.method !== "POST") return res.status(405).json({ code: "invalid_request" });
  if (!pronto) return res.status(503).json({ code: "nao_configurado", message: "Falta ELEVENLABS_API_KEY ou ELEVENLABS_VOICE_ID no Vercel" });
  if (req.headers["x-made-codigo"] !== process.env.MADE_CODIGO) return res.status(401).json({ code: "not_granted" });

  // limite de tamanho: cada caractere gasta crédito do ElevenLabs
  const texto = String(req.body?.texto || "").replace(/\s+/g, " ").trim().slice(0, 700);
  if (!texto) return res.status(400).json({ code: "invalid_request", message: "Texto vazio" });

  const voz = encodeURIComponent(process.env.ELEVENLABS_VOICE_ID);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voz}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({
      text: texto,
      model_id: process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5",
      language_code: "pt",
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true },
    }),
  }).catch(() => null);

  if (!r) return res.status(502).json({ code: "upstream_error" });
  if (!r.ok) {
    const corpo = await r.text().catch(() => "");
    console.error("ElevenLabs", r.status, corpo.slice(0, 300));
    const code = r.status === 401 ? "chave_invalida" : r.status === 429 ? "rate_limited" : /quota|credit/i.test(corpo) ? "sem_creditos" : "upstream_error";
    return res.status(r.status === 429 ? 429 : 502).json({ code });
  }
  const audio = Buffer.from(await r.arrayBuffer());
  res.setHeader("content-type", "audio/mpeg");
  res.setHeader("cache-control", "no-store");
  return res.status(200).send(audio);
}
