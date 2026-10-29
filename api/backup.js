// Cópia de segurança do MADE no Vercel Blob (loja privada).
// O app manda os dados já criptografados com o código de acesso; aqui só guardamos e devolvemos.
// Variáveis: BLOB_READ_WRITE_TOKEN (criado pelo Vercel ao ligar o Blob) e MADE_CODIGO.
import { put, list, get, del } from "@vercel/blob";

export const config = { maxDuration: 30 };

const PASTA = "made-backup/";
const ULTIMA = PASTA + "ultima.json";
const MANTER_DIAS = 30;

// o Vercel liga o Blob com BLOB_READ_WRITE_TOKEN (jeito antigo) ou BLOB_STORE_ID + OIDC (jeito novo)
const pronto = () => (!!process.env.BLOB_READ_WRITE_TOKEN || !!process.env.BLOB_STORE_ID) && !!process.env.MADE_CODIGO;
const diagnostico = () => ({ token: !!process.env.BLOB_READ_WRITE_TOKEN, loja: !!process.env.BLOB_STORE_ID, oidc: !!process.env.VERCEL_OIDC_TOKEN, codigo: !!process.env.MADE_CODIGO });

async function ler(caminho) {
  const r = await get(caminho, { access: "private", useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return await new Response(r.stream).text();
}

export default async function handler(req, res) {
  if (!pronto()) {
    if (req.method === "GET" && !req.headers["x-made-codigo"]) return res.status(200).json({ ok: false, tem: diagnostico() });
    return res.status(503).json({ code: "nao_configurado", message: "Falta ligar o Blob no projeto made do Vercel" });
  }
  // sem código: só diz se o backup está ligado e quando foi o último (sem nenhum dado)
  if (req.method === "GET" && !req.headers["x-made-codigo"]) {
    try {
      const { blobs } = await list({ prefix: ULTIMA, limit: 1 });
      return res.status(200).json({ ok: true, ultimo: blobs[0]?.uploadedAt || null });
    } catch (e) {
      console.error(e);
      return res.status(200).json({ ok: false, erro: "loja" });
    }
  }
  if (req.headers["x-made-codigo"] !== process.env.MADE_CODIGO) return res.status(401).json({ code: "not_granted" });

  try {
    if (req.method === "GET") {
      const texto = await ler(ULTIMA);
      if (!texto) return res.status(404).json({ code: "sem_backup" });
      res.setHeader("cache-control", "no-store");
      return res.status(200).send(texto);
    }
    if (req.method === "POST") {
      const b = req.body || {};
      if (typeof b.dados !== "string" || typeof b.iv !== "string" || typeof b.sal !== "string") return res.status(400).json({ code: "invalid_request" });
      const texto = JSON.stringify({ v: 1, dados: b.dados, iv: b.iv, sal: b.sal, em: Date.now(), n: Number(b.n) || 0 });
      if (texto.length > 3_500_000) return res.status(413).json({ code: "too_large" });
      const dia = new Date().toISOString().slice(0, 10);
      const opts = { access: "private", addRandomSuffix: false, allowOverwrite: true, contentType: "application/json" };
      await put(ULTIMA, texto, opts);
      await put(`${PASTA}dias/${dia}.json`, texto, opts);
      // apaga cópias diárias com mais de 30 dias
      const { blobs } = await list({ prefix: PASTA + "dias/", limit: 1000 });
      const limite = Date.now() - MANTER_DIAS * 864e5;
      const velhas = blobs.filter((x) => new Date(x.uploadedAt).getTime() < limite).map((x) => x.url);
      if (velhas.length) await del(velhas);
      return res.status(200).json({ ok: true, em: Date.now() });
    }
    return res.status(405).json({ code: "invalid_request" });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ code: "loja", message: e?.message || "Falha no armazenamento" });
  }
}
