document.getElementById("predictBtn").addEventListener("click", predict);

async function predict() {
  const apiKey = "3VJ56RZG35XVKFQI";
  const url = `https://www.alphavantage.co/query?function=FX_DAILY&from_symbol=EUR&to_symbol=USD&apikey=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  console.log("APIレスポンス:", data);

  if (!data["Time Series FX (Daily)"]) {
    document.getElementById("result").innerText =
      "APIエラー：データが取得できませんでした。\n\n" +
      JSON.stringify(data, null, 2);
    return;
  }

  const timeSeries = data["Time Series FX (Daily)"];
  const closes = Object.values(timeSeries).map(v => parseFloat(v["4. close"]));

  const sma5 = sma(closes, 5);
  const sma20 = sma(closes, 20);

  const signal = sma5 > sma20 ? "BUY" : "SELL";

  document.getElementById("result").innerText =
    `SMA5: ${sma5.toFixed(5)}\nSMA20: ${sma20.toFixed(5)}\n判定: ${signal}`;
}

function sma(values, period) {
  const slice = values.slice(0, period);
  return slice.reduce((a, b) => a + b, 0) / period;
}
