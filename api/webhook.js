// api/webhook.js — formato correto para Vercel (Serverless Function)

export default async function handler(req, res) {
  // 1) Verificação do Webhook (a Meta chama GET com o seu VERIFY_TOKEN)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      // Se o token bateu, devolve o challenge (ex: 12345)
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Token inválido");
  }

  // 2) Receber mensagens do WhatsApp (a Meta envia POST)
  if (req.method === "POST") {
    try {
      // Em alguns ambientes req.body pode vir string; tratamos os dois casos
      const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      const change = body?.entry?.[0]?.changes?.[0];
      const msg = change?.value?.messages?.[0];

      if (!msg || !msg.from) {
        return res.status(200).end(); // nada pra responder
      }

      const from = msg.from;
      const text =
        msg.text?.body ||
        msg.button?.text ||
        msg.interactive?.list_reply?.title ||
        "";

      // Resposta simples (depois a gente pluga o GPT, se quiser)
      const reply = "Olá! Recebi sua mensagem. Posso te enviar valores e condições?";

      // Envia a resposta pelo WhatsApp Cloud API
      await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: reply },
        }),
      });

      return res.status(200).end();
    } catch (e) {
      console.error("Erro no webhook:", e);
      return res.status(200).end(); // evita re-tentativas
    }
  }

  return res.status(405).send("Method not allowed");
}
