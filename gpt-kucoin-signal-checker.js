// ✅ KuCoin GPT Signal Bot with Live OpenAI API (GPT-3.5-Turbo)
require("dotenv").config();
const axios = require("axios");
const crypto = require("crypto");
const WebSocket = require("ws");
const OpenAI = require("openai");
const { calculateIndicators } = require("./indicators");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const KUCOIN_API_KEY = process.env.KUCOIN_API_KEY;
const KUCOIN_API_SECRET = process.env.KUCOIN_API_SECRET;
const KUCOIN_API_PASSPHRASE = process.env.KUCOIN_API_PASSPHRASE;
const KUCOIN_API_BASE = "https://api.kucoin.com";
const SYMBOL = "BTC-USDT";
const INTERVAL = "1min";

let candles = [];

async function getWebSocketToken() {
  const now = Date.now();
  const strToSign = now + "GET" + "/api/v1/bullet-public";
  const signature = crypto
    .createHmac("sha256", KUCOIN_API_SECRET)
    .update(strToSign)
    .digest("base64");

  const headers = {
    "KC-API-KEY": KUCOIN_API_KEY,
    "KC-API-SIGN": signature,
    "KC-API-TIMESTAMP": now,
    "KC-API-PASSPHRASE": KUCOIN_API_PASSPHRASE,
    "KC-API-KEY-VERSION": "2",
  };

  const response = await axios.post(`${KUCOIN_API_BASE}/api/v1/bullet-public`, {}, { headers });
  return response.data.data;
}

(async () => {
  try {
    const tokenData = await getWebSocketToken();
    const wsUrl = `${tokenData.instanceServers[0].endpoint}?token=${tokenData.token}`;
    const ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      console.log(`🟢 Connected to KuCoin WS (${SYMBOL} @ ${INTERVAL})`);
      const subMsg = {
        id: Date.now().toString(),
        type: "subscribe",
        topic: `/market/candles:${SYMBOL}_${INTERVAL}`,
        response: true,
      };
      ws.send(JSON.stringify(subMsg));
    });

    ws.on("message", async (data) => {
      try {
        const parsed = JSON.parse(data);
        if (
          parsed.topic &&
          parsed.data &&
          parsed.topic.includes(`/market/candles:${SYMBOL}_${INTERVAL}`)
        ) {
          const [time, open, close, high, low, vol, turnover] = parsed.data.candles || parsed.data;
          console.log("🔍 Raw candle data:", parsed.data);

          if (!close) return;

          candles.push({ open: parseFloat(open), close: parseFloat(close), high: parseFloat(high), low: parseFloat(low) });
          if (candles.length > 100) candles.shift();

          console.log(`📊 Candle added: Close = ${close}`);

          const { rsi, macd } = calculateIndicators(candles);
          if (!rsi || !macd) return;

          const prompt = `
You are a crypto grid trading assistant.
Here’s the current data:
- Symbol: ${SYMBOL}
- Price: ${close}
- RSI(5): ${rsi.toFixed(2)}
- MACD Histogram: ${(macd.histogram || 0).toFixed(4)}
- MACD Signal: ${(macd.signal || 0).toFixed(4)}
- Strategy: Short-biased grid
What should I do? Hold, adjust grid, pause, or exit?
`;

          const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [{ role: "user", content: prompt }],
          });

          console.log(`🤖 GPT Says: ${response.choices[0].message.content}`);
        }
      } catch (err) {
        console.error("❌ GPT or Parse Error:", err.message);
      }
    });
  } catch (err) {
    console.error("❌ KuCoin Auth Error:", err.message);
  }
})();
