document.getElementById("predictBtn").addEventListener("click", predict);

async function predict() {
  const apiKey = "3VJ56RZG35XVKFQI"; // ← あなたの本物のAPIキーに置き換え
  const from = "EUR";
  const to = "USD";
  const symbol = "EURUSD"; // ADX用

  const resultEl = document.getElementById("result");
  resultEl.innerText = "判定中…";

  try {
    // ① 日足（FX_DAILY）
    const dailyUrl =
      `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=${from}&to_symbol=${to}&apikey=${apiKey}`;
    const dailyRes = await fetch(dailyUrl);
    const dailyData = await dailyRes.json();

    // ② 週足（FX_WEEKLY）
    const weeklyUrl =
      `https://www.alphavantage.co/query?function=FX_WEEKLY&from_symbol=${from}&to_symbol=${to}&apikey=${apiKey}`;
    const weeklyRes = await fetch(weeklyUrl);
    const weeklyData = await weeklyRes.json();

    // ③ ADX（日足・14期間）
    const adxUrl =
      `https://www.alphavantage.co/query?function=ADX&symbol=${symbol}&interval=daily&time_period=14&series_type=close&apikey=${apiKey}`;
    const adxRes = await fetch(adxUrl);
    const adxData = await adxRes.json();

    console.log("FX_DAILY:", dailyData);
    console.log("FX_WEEKLY:", weeklyData);
    console.log("ADX:", adxData);

    // --- エラーチェック ---
    const dailyTS = dailyData["Time Series FX (Daily)"];
    const weeklyTS = weeklyData["Time Series FX (Weekly)"];
    const adxTS = adxData["Technical Analysis: ADX"];

    if (!dailyTS || !weeklyTS || !adxTS) {
      resultEl.innerText =
        "APIエラー：必要なデータが取得できませんでした。\n\n" +
        JSON.stringify({ dailyData, weeklyData, adxData }, null, 2);
      return;
    }

    // --- 日足データ処理 ---
    const dailyDates = Object.keys(dailyTS).sort((a, b) => new Date(b) - new Date(a));
    const latestDaily = dailyTS[dailyDates[0]];

    const dailyClose = parseFloat(latestDaily["4. close"]);
    const dailyOpen = parseFloat(latestDaily["1. open"]);

    const dailyCloses = dailyDates.map(d => parseFloat(dailyTS[d]["4. close"]));
    const dailySma5 = sma(dailyCloses, 5);
    const dailySma20 = sma(dailyCloses, 20);

    const dailyTrend =
      dailySma5 > dailySma20 ? "UP" :
      dailySma5 < dailySma20 ? "DOWN" : "FLAT";

    const candleDir =
      dailyClose > dailyOpen ? "UP" :
      dailyClose < dailyOpen ? "DOWN" : "FLAT";

    // --- 週足データ処理 ---
    const weeklyDates = Object.keys(weeklyTS).sort((a, b) => new Date(b) - new Date(a));
    const weeklyCloses = weeklyDates.map(d => parseFloat(weeklyTS[d]["4. close"]));
    const weeklySma5 = sma(weeklyCloses, 5);
    const weeklySma20 = sma(weeklyCloses, 20);

    const weeklyTrend =
      weeklySma5 > weeklySma20 ? "UP" :
      weeklySma5 < weeklySma20 ? "DOWN" : "FLAT";

    // --- ADX処理 ---
    const adxDates = Object.keys(adxTS).sort((a, b) => new Date(b) - new Date(a));
    const latestAdx = parseFloat(adxTS[adxDates[0]]["ADX"]);
    const strongTrend = latestAdx > 20;

    // --- 最終判定 ---
    let signal = "NO TRADE";
    let reason = [];

    if (dailyTrend === "UP" && candleDir === "UP" && weeklyTrend === "UP" && strongTrend) {
      signal = "BUY";
      reason.push("日足・週足とも上昇トレンドかつ陽線・ADX>20");
    } else if (dailyTrend === "DOWN" && candleDir === "DOWN" && weeklyTrend === "DOWN" && strongTrend) {
      signal = "SELL";
      reason.push("日足・週足とも下降トレンドかつ陰線・ADX>20");
    } else {
      reason.push("条件がすべて揃っていないためノートレード判定");
    }

    // --- 表示 ---
    resultEl.innerText =
      `【最終判定】\n` +
      `判定: ${signal}\n\n` +
      `【日足】\n` +
      `SMA5:  ${dailySma5.toFixed(5)}\n` +
      `SMA20: ${dailySma20.toFixed(5)}\n` +
      `トレンド: ${dailyTrend}\n` +
      `ローソク足: ${candleDir}（始値 ${dailyOpen}, 終値 ${dailyClose}）\n\n` +
      `【週足】\n` +
      `SMA5:  ${weeklySma5.toFixed(5)}\n` +
      `SMA20: ${weeklySma20.toFixed(5)}\n` +
      `トレンド: ${weeklyTrend}\n\n` +
      `【ADX（日足）】\n` +
      `ADX: ${latestAdx.toFixed(2)}（>20でトレンド強い）\n\n` +
      `【コメント】\n` +
      reason.join("\n");
  } catch (e) {
    console.error(e);
    resultEl.innerText = "予測中にエラーが発生しました。\n" + e;
  }
}

function sma(values, period) {
  if (values.length < period) return NaN;
  const slice = values.slice(0, period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}
