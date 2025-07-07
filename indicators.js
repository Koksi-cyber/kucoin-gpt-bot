const ti = require("technicalindicators");

function calculateIndicators(candles) {
  const closes = candles.map(c => parseFloat(c.close));

  const rsi = ti.RSI.calculate({ values: closes, period: 5 }); // shortened for testing
  const macd = ti.MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });

  return {
    rsi: rsi[rsi.length - 1],
    macd: macd[macd.length - 1],
  };
}

module.exports = { calculateIndicators };
