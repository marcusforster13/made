// Envia o relatório do MADE por e-mail (Resend), sempre para o mesmo endereço do dono.
// Variáveis no Vercel: RESEND_API_KEY, MADE_EMAIL (destino) e, opcional, MADE_EMAIL_FROM.
import { Resend } from "resend";

export const config = { maxDuration: 30 };

const esconder = (e) => String(e || "").replace(/^(.)(.*)(.@.*)$/, (_, a, b, c) => a + "*".repeat(Math.min(b.length, 6)) + c);

export default async function handler(req, res) {
  const pronto = !!process.env.RESEND_API_KEY && !!process.env.MADE_EMAIL && !!process.env.MADE_CODIGO;
  if (req.method === "GET") return res.status(200).json({ ok: pronto, para: pronto ? esconder(process.env.MADE_EMAIL) : "" });
  if (req.method !== "POST") return res.status(405).json({ code: "invalid_request" });
  if (!pronto) return res.status(503).json({ code: "nao_configurado", message: "Falta RESEND_API_KEY ou MADE_EMAIL no Vercel" });
  if (req.headers["x-made-codigo"] !== process.env.MADE_CODIGO) return res.status(401).json({ code: "not_granted" });

  const { assunto, html, pdf, arquivo } = req.body || {};
  if (!html || typeof html !== "string" || html.length > 200000) return res.status(400).json({ code: "invalid_request", message: "Relatório vazio ou grande demais" });
  const anexos = [];
  if (typeof pdf === "string" && pdf.length) {
    if (pdf.length > 4_000_000) return res.status(413).json({ code: "too_large" });
    anexos.push({ filename: String(arquivo || "MADE-relatorio.pdf").replace(/[^\w.\-]/g, "_"), content: Buffer.from(pdf, "base64") });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { data, error } = await resend.emails.send({
    from: process.env.MADE_EMAIL_FROM || "Dom do MADE <onboarding@resend.dev>",
    to: process.env.MADE_EMAIL,
    subject: String(assunto || "Seu relatório do MADE").slice(0, 150),
    html,
    attachments: anexos,
  });
  if (error) {
    console.error(error);
    return res.status(502).json({ code: "envio_falhou", message: error.message || "O Resend recusou o envio" });
  }
  return res.status(200).json({ ok: true, id: data?.id });
}
