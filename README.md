# MADE · Meu Acompanhamento De Economia

App de bolso para controlar entradas e saídas, cortar gastos supérfluos e juntar dinheiro para o sítio, com o **Dom**, o mascote consultor.

## O que roda onde

| Parte | Onde | Precisa de API? |
|---|---|---|
| Anotar gastos, saldo, alertas, "pode gastar hoje", orçamento, dívidas, plano de cada entrada, metas, PDF e planilha | No próprio celular | Não |
| Dom com IA: anotar escrevendo, ler extrato e print, diagnóstico, relatório semanal, chat | `api/dom.js` no Vercel → API do Claude | Sim (`ANTHROPIC_API_KEY`) |

Os lançamentos ficam guardados **no aparelho** (armazenamento do navegador). Não apague os dados do site no navegador e baixe a planilha CSV de vez em quando como cópia de segurança.

## Publicar no Vercel (uma vez)

1. Entre em **vercel.com** com sua conta do GitHub.
2. **Add New → Project** → escolha o repositório **made** → **Import**.
3. Antes de clicar em Deploy, abra **Environment Variables** e crie:
   - `MADE_CODIGO`: um código só seu (ex.: uma frase que você lembre). O app pede esse código uma vez no celular. Ele impede que outras pessoas gastem seus créditos da IA.
   - `ANTHROPIC_API_KEY`: sua chave da API do Claude (console.anthropic.com → API Keys). Sem ela o app funciona, só sem a IA do Dom.
4. Clique em **Deploy**. O endereço fica algo como `made-xxxx.vercel.app`.

Toda vez que algo novo for enviado para o GitHub, o Vercel atualiza o app sozinho.

## Instalar no celular

- **Android (Chrome):** abra o endereço → menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.
- **iPhone (Safari):** abra o endereço → botão Compartilhar → **Adicionar à Tela de Início**.

## Arquivos

- `index.html`: o app inteiro (visual, cálculos, Dom).
- `standalone.js`: guarda os dados no aparelho e conversa com a `/api/dom`.
- `api/dom.js`: função do Vercel que chama o Claude (`claude-opus-5-5`, com fallback automático se o modelo recusar).
- `sw.js` e `manifest.webmanifest`: deixam o app instalável e abrindo sem internet.

## Próximas fases

- Dom no Telegram: recado diário às 20h, relatório de segunda e anotar gastos por mensagem.
- Banco de dados na nuvem (Supabase) para ver os mesmos dados no celular e no computador.

O MADE é orientação educativa, não recomendação profissional de investimento.
