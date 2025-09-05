// api/webhook.js
// Robô simples: verifica o webhook, recebe mensagens e responde com GPT (ou mensagem padrão)

module.exports = async (req, res) => {
  // 1) Verificação do Webhook (Meta chama GET uma vez com seu VERIFY_TOKEN)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Token inválido");
  }

  // 2) Receber mensagens do WhatsApp (POST sempre que alguém te manda msg)
  if (req.method === "POST") {
    try {
      const change = req.body?.entry?.[0]?.changes?.[0];
      const msg = change?.value?.messages?.[0];
      const from = msg?.from; // telefone do cliente
      const text =
        msg?.text?.body ||
        msg?.button?.text ||
        msg?.interactive?.list_reply?.title ||
        "";

      if (!from) return res.status(200).end();

      // 2.a) Gerar resposta com OpenAI (opcional; se falhar, usa fallback)
      let reply = "Olá! Recebi sua mensagem. Posso te enviar um resumo com valores e condições?";
      try {
        if (process.env.OPENAI_API_KEY) {
          const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4.1-mini",
              temperature: 0.3,
              messages: [
                { role: "system", content: "Você é um assistente imobiliário da Helbor: curto, educado e objetivo. Se fizer sentido, peça bairro, metragem, faixa de preço e se é moradia ou investimento." },
                { role: "user", content: text || "Olá" },
              ],
            }),
          }).then(r => r.json());

          reply = r?.choices?.[0]?.message?.content?.slice(0, 900) || reply;
        }
      } catch { /* se der erro, segue com reply padrão */ }

      // 2.b) Responder o cliente no WhatsApp
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
      console.error(e);
      return res.status(200).end();
    }
  }

  return res.status(405).send("Method not allowed");
};
