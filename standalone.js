/* MADE fora do claude.ai: guarda os dados neste aparelho e fala com o Dom pela /api/dom.
   Dentro do claude.ai o window.claude já existe e este arquivo não faz nada. */
(function () {
  if (window.claude) return;

  /* ---------- banco local (mesma forma de uso do db do claude.ai) ---------- */
  const CHAVE = "made-dados-v1";
  const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || {}; } catch (e) { return {}; } };
  let store = ler();
  // cada ouvinte escuta um documento ou uma coleção; só é avisado quando o que ele escuta muda
  const ouvintes = new Set();
  const toca = (o, mudou) => !mudou || (o.col ? mudou.startsWith(o.path + "/") && !mudou.slice(o.path.length + 1).includes("/") : o.path === mudou);
  const avisar = (mudou) => ouvintes.forEach((o) => { if (toca(o, mudou)) o.f(); });
  const ouvir = (path, col, f) => { const o = { path, col, f }; ouvintes.add(o); setTimeout(f, 0); return () => ouvintes.delete(o); };
  function gravar(mudou) {
    try { localStorage.setItem(CHAVE, JSON.stringify(store)); }
    catch (e) { throw { code: "quota_exceeded", message: "Sem espaço no aparelho" }; }
    avisar(mudou);
  }
  addEventListener("storage", (e) => { if (e.key === CHAVE) { store = ler(); avisar(); } });
  const copia = (d) => JSON.parse(JSON.stringify(d));
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const meta = { fromCache: false, hasPendingWrites: false };
  const snap = (id, d) => ({ id, exists: d !== undefined, data: () => d, metadata: meta });
  function mescla(a, b) {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) {
      out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k]) ? mescla(a[k], v) : v;
    }
    return out;
  }
  function docRef(path) {
    const id = path.split("/").pop();
    return {
      id, path,
      get: async () => snap(id, store[path]),
      set: async (d) => { store[path] = copia(d); gravar(path); },
      update: async (d) => {
        if (!store[path]) throw { code: "invalid_argument", message: "Documento não existe" };
        store[path] = mescla(store[path], copia(d)); gravar(path);
      },
      delete: async () => { delete store[path]; gravar(path); },
      onSnapshot(next) { return ouvir(path, false, () => next(snap(id, store[path]))); },
      collection: (nome) => colRef(path + "/" + nome),
    };
  }
  function colRef(path) {
    const filhos = () => Object.keys(store).filter((k) => k.startsWith(path + "/") && !k.slice(path.length + 1).includes("/")).sort();
    const consulta = () => { const docs = filhos().map((k) => snap(k.split("/").pop(), store[k])); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: meta }; };
    const ref = {
      path,
      doc: (id) => docRef(path + "/" + (id || novoId())),
      add: async (d) => { const r = docRef(path + "/" + novoId()); await r.set(d); return r; },
      get: async () => consulta(),
      onSnapshot(next) { return ouvir(path, true, () => next(consulta())); },
      where: () => ref, orderBy: () => ref, limit: () => ref,
    };
    return ref;
  }
  const db = { doc: docRef, collection: colRef };

  const user = { id: async () => "local", me: async () => ({ id: "local" }), isOwner: () => true, canEdit: () => true, can: () => true, profiles: async () => ({}) };

  /* ---------- Dom (IA) pela função do Vercel ---------- */
  const erro = (code, message) => ({ code, message: message || code });
  function codigo(pedir) {
    let c = ""; try { c = localStorage.getItem("made-codigo") || ""; } catch (e) {}
    if (!c && pedir) {
      c = (prompt("Digite o código de acesso do MADE (o mesmo que você colocou no Vercel em MADE_CODIGO):") || "").trim();
      if (c) try { localStorage.setItem("made-codigo", c); } catch (e) {}
    }
    return c;
  }
  const paraBase64 = (blob) => new Promise((ok, falha) => {
    const r = new FileReader();
    r.onload = () => ok({ type: blob.type || "image/png", data: String(r.result).split(",")[1] });
    r.onerror = falha; r.readAsDataURL(blob);
  });
  async function chamar(input, opts = {}, json = false) {
    if (opts.signal?.aborted) throw erro("cancelled");
    const imgs = opts.images ? await Promise.all([...(opts.images.length !== undefined ? opts.images : [opts.images])].map(paraBase64)) : undefined;
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const c = codigo(true);
      if (!c) throw erro("not_granted", "Sem código de acesso");
      let resp;
      try {
        resp = await fetch("api/dom", {
          method: "POST", signal: opts.signal,
          headers: { "content-type": "application/json", "x-made-codigo": c },
          body: JSON.stringify({ input, images: imgs, tier: opts.modelTier || "default", json }),
        });
      } catch (e) { throw erro(opts.signal?.aborted ? "cancelled" : "upstream_error", "Sem conexão"); }
      const corpo = await resp.json().catch(() => ({}));
      if (resp.status === 401) { try { localStorage.removeItem("made-codigo"); } catch (e) {} alert("Código de acesso errado. Tente de novo."); continue; }
      if (!resp.ok) throw erro(corpo.code || "upstream_error", corpo.message);
      const text = String(corpo.text || "");
      if (!text.trim()) throw erro("empty_completion");
      opts.onText?.({ text, delta: text });
      return { text, truncated: !!corpo.truncated, modelTierApplied: "default" };
    }
    throw erro("not_granted", "Código de acesso inválido");
  }
  function lerJson(text) {
    try { return JSON.parse(text); } catch (e) {}
    const cerca = text.match(/```(?:json)?\s*([\s\S]*?)```/); if (cerca) try { return JSON.parse(cerca[1]); } catch (e) {}
    const i = text.search(/[\[{]/), j = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
    if (i >= 0 && j > i) try { return JSON.parse(text.slice(i, j + 1)); } catch (e) {}
    throw { code: "invalid_json", message: "Resposta sem JSON", text };
  }
  const sample = (input, opts) => chamar(input, opts, false);
  sample.json = async (input, opts) => lerJson((await chamar(input, opts, true)).text);
  sample.limits = async () => ({ maxPromptBytes: 262144, images: { maxCount: 4, maxInputBytes: 3e6, mediaTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] } });

  let iaLigada = null;
  const statusIA = () => iaLigada || (iaLigada = fetch("api/dom").then((r) => r.json()).then((s) => !!s.ia).catch(() => false));

  /* ---------- baixar arquivos ---------- */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      return { status: "saved" };
    },
  };

  // usado pelo relatório por e-mail, que fala com a api/email com o mesmo código
  window.MADE = {
    codigo,
    esquecer: () => { try { localStorage.removeItem("made-codigo"); } catch (e) {} },
    // cópia de segurança: tudo que o app guardou neste aparelho
    exportar: () => JSON.stringify(store),
    importar: (dados) => {
      if (!dados || typeof dados !== "object" || !Object.keys(dados).some((k) => k.startsWith("data/users/"))) throw new Error("Arquivo não é um backup do MADE");
      store = dados; gravar();
    },
  };

  window.claude = {
    use: async (nome) => {
      if (nome === "db") return db;
      if (nome === "user") return user;
      if (nome === "downloads") return downloads;
      if (nome === "sample") return (await statusIA()) ? sample : null;
      return null;
    },
  };

  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
