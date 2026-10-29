# MADE · Meu Acompanhamento De Economia

App de bolso para controlar entradas e saídas, cortar gastos supérfluos e juntar dinheiro para o sítio, com o **Dom**, o mascote consultor.

## O que roda onde

| Parte | Onde | Precisa de API? |
|---|---|---|
| Anotar gastos, saldo, alertas, "pode gastar hoje", orçamento, dívidas, plano de cada entrada, metas, PDF e planilha | No próprio celular | Não |
| Dom com IA: aba Dom (conversa por voz ou texto que anota gastos, gastos fixos, metas e limites), anotar escrevendo, ler extrato e print, diagnóstico, relatório semanal | `api/dom.js` no Vercel → API do Claude | Sim (`ANTHROPIC_API_KEY`) |
| Relatório da semana por e-mail com o PDF do mês | `api/email.js` no Vercel → Resend | Sim (`RESEND_API_KEY`) |

Os lançamentos ficam guardados **no aparelho** (armazenamento do navegador). A cópia de segurança (Consultor → Cópia de segurança) guarda tudo na nuvem, criptografado, e também dá para baixar um arquivo.

## Publicar no Vercel (uma vez)

1. Entre em **vercel.com** com sua conta do GitHub.
2. **Add New → Project** → escolha o repositório **made** → **Import**.
3. Antes de clicar em Deploy, abra **Environment Variables** e crie:
   - `MADE_CODIGO`: um código só seu (ex.: uma frase que você lembre). O app pede esse código uma vez no celular. Ele impede que outras pessoas gastem seus créditos da IA.
   - `ANTHROPIC_API_KEY`: sua chave da API do Claude (console.anthropic.com → API Keys). Sem ela o app funciona, só sem a IA do Dom.
   - `RESEND_API_KEY`: chave do Resend (resend.com → API Keys), para o relatório por e-mail.
   - `MADE_EMAIL`: o e-mail que recebe o relatório. Com o remetente padrão do Resend (`onboarding@resend.dev`), tem que ser o mesmo e-mail da sua conta no Resend.
   - `ELEVENLABS_API_KEY` e `ELEVENLABS_VOICE_ID`: voz própria do Dom (elevenlabs.io). Sem elas, o Dom fala com a voz do celular. Opcional: `ELEVENLABS_MODEL` (padrão `eleven_flash_v2_5`).
   - `BLOB_READ_WRITE_TOKEN`: criado sozinho pelo Vercel ao ligar o Blob no projeto (Storage → Blob, loja privada). Guarda a cópia de segurança criptografada.
   - `MADE_EMAIL_FROM` (opcional): remetente próprio, ex.: `Dom do MADE <dom@mofl.com.br>`, depois de verificar o domínio no Resend.
4. Clique em **Deploy**. O endereço fica algo como `made-xxxx.vercel.app`.

Toda vez que algo novo for enviado para o GitHub, o Vercel atualiza o app sozinho.

## Instalar no celular

- **Android (Chrome):** abra o endereço → menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.
- **iPhone (Safari):** abra o endereço → botão Compartilhar → **Adicionar à Tela de Início**.

## Arquivos

- `index.html`: o app inteiro (visual, cálculos, Dom).
- `standalone.js`: guarda os dados no aparelho e conversa com a `/api/dom`.
- `api/dom.js`: função do Vercel que chama o Claude (`claude-opus-5-5`, com fallback automático se o modelo recusar).
- `api/voz.js`: função do Vercel que gera a fala do Dom no ElevenLabs (até 700 caracteres por resposta).
- `api/backup.js`: guarda e devolve a cópia de segurança no Vercel Blob. O app criptografa antes de enviar (AES-GCM com chave tirada do `MADE_CODIGO`), então trocar o código deixa as cópias antigas ilegíveis. Mantém a última cópia e uma por dia por 30 dias.
- `api/email.js`: função do Vercel que manda o relatório pelo Resend, sempre para `MADE_EMAIL`.

O relatório semanal sai na primeira vez que o app é aberto a partir de segunda-feira (os dados ficam no celular, então é o celular que monta o PDF e pede o envio).
- `sw.js` e `manifest.webmanifest`: deixam o app instalável e abrindo sem internet.

## Próximas fases

- Dom no WhatsApp ou Telegram: recado diário, relatório de segunda e anotar gastos por mensagem.
- Banco de dados na nuvem (Supabase) para ver os mesmos dados no celular e no computador.

O MADE é orientação educativa, não recomendação profissional de investimento.
