document.getElementById("predictBtn").addEventListener("click", predict);

async function predict() {
  const apiKey = "3VJ56RZG35XVKFQI"; // ← あなたの本物のAPIキー
  const from = "EUR";
  const to = "USD";
  const symbol = "EURUSD";

  const resultEl = document.getElementById("result");
  resultEl.innerText = "判定中…";

  try {
    // --- API呼び出し ---
    const dailyUrl = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&apikey=${apiKey}`;
    const weeklyUrl = `https://www.alphavantage.co/query?function=FX_WEEKLY&from_symbol=${from}&to_symbol=${to}&apikey=${apiKey}`;
    const adxUrl = `https://www.alphavantage.co/query?function=ADX&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`;

    const [dailyRes, weeklyRes, adxRes] = await Promise.all([
      fetch(dailyUrl),
      fetch(weeklyUrl),
      fetch(adxUrl)
    ]);

    const dailyData = await dailyRes.json();
    const weeklyData = await weeklyRes.json();
    const adxData = await adxRes.json();

    console.log("FX_DAILY:", dailyData);
    console.log("FX_WEEKLY:", weeklyData);
    console.log("ADX:", adxData);

    // --- 日足データ（必須） ---
    const dailyTS = dailyData["Time Series FX (Daily)"];
    if (!dailyTS) {
      resultEl.innerText = "日足データが取得できませんでした。";
      return;
    }

    const dailyDates = Object.keys(dailyTS).sort((a, b) => new Date(b) - new Date(a));
    const latestDaily = dailyTS[dailyDates[0]];

    const dailyOpen = parseFloat(latestDaily["1. open"]);
    const dailyClose = parseFloat(latestDaily["4. close"]);
    const dailyCloses = dailyDates.map(d => parseFloat(dailyTS[d]["4. close"]));

    const dailySma5 = sma(dailyCloses, 5);
    const dailySma20 = sma(dailyCloses, 20);

    const dailyTrend =
      dailySma5 > dailySma20 ? "UP" :
      dailySma5 < dailySma20 ? "DOWN" : "FLAT";

    const candleDir =
      dailyClose > dailyOpen ? "UP" :
      dailyClose < dailyOpen ? "DOWN" : "FLAT";

    // --- 週足データ（返らない場合は null） ---
    let weeklyTrend = null;
    if (weeklyData["Time Series FX (Weekly)"]) {
      const weeklyTS = weeklyData["Time Series FX (Weekly)"];
      const weeklyDates = Object.keys(weeklyTS).sort((a, b) => new Date(b) - new Date(a));
      const weeklyCloses = weeklyDates.map(d => parseFloat(weeklyTS[d]["4. close"]));

      const weeklySma5 = sma(weeklyCloses, 5);
      const weeklySma20 = sma(weeklyCloses, 20);

      weeklyTrend =
        weeklySma5 > weeklySma20 ? "UP" :
        weeklySma5 < weeklySma20 ? "DOWN" : "FLAT";
    }

    // --- ADX（返らない場合は null） ---
    let adxVal = null;
    if (adxData["Technical Analysis: ADX"]) {
      const adxTS = adxData["Technical Analysis: ADX"];
      const adxDates = Object.keys(adxTS).sort((a, b) => new Date(b) - new Date(a));
      adxVal = parseFloat(adxTS[adxDates[0]]["ADX"]);
    }

    // --- 最終判定 ---
    let signal = "NO TRADE";
    let reason = [];

    // 基本（日足）判定
    if (dailyTrend === "UP" && candleDir === "UP") {
      signal = "BUY";
      reason.push("日足が上昇トレンドかつ陽線");
    } else if (dailyTrend === "DOWN" && candleDir === "DOWN") {
      signal = "SELL";
      reason.push("日足が下降トレンドかつ陰線");
    } else {
      reason.push("日足条件が揃っていない");
    }

    // 週足が返ってきた場合のみ精度UP
    if (weeklyTrend) {
      if (signal === "BUY" && weeklyTrend !== "UP") {
        signal = "NO TRADE";
        reason.push("週足が上昇トレンドではないため除外");
      }
      if (signal === "SELL" && weeklyTrend !== "DOWN") {
        signal = "NO TRADE";
        reason.push("週足が下降トレンドではないため除外");
      }
    } else {
      reason.push("週足データなし → スキップ");
    }

    // ADXが返ってきた場合のみ精度UP
    if (adxVal !== null) {
      if (adxVal <= 20) {
        signal = "NO TRADE";
        reason.push("ADX<=20 → トレンド弱いため除外");
      } else {
        reason.push("ADX>20 → トレンド強い");
      }
    } else {
      reason.push("ADXデータなし → スキップ");
    }

    // --- 表示 ---
    resultEl.innerText =
      `【最終判定】\n${signal}\n\n` +
      `【日足】\nSMA5: ${dailySma5.toFixed(5)}\nSMA20: ${dailySma20.toFixed(5)}\nトレンド: ${dailyTrend}\nローソク足: ${candleDir}\n\n` +
      `【週足】\n${weeklyTrend ?? "データなし"}\n\n` +
      `【ADX】\n${adxVal !== null ? adxVal.toFixed(2) : "データなし"}\n\n` +
      `【コメント】\n` +
      reason.join("\n");

  } catch (e) {
    resultEl.innerText = "予測中にエラーが発生しました。\n" + e;
  }
}

function sma(values, period) {
  if (values.length < period) return NaN;
  return values.slice(0, period).reduce((a, b) => a + b, 0) / period;
}
