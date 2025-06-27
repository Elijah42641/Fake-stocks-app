let userTradeWithinCurrentSecond;

const path = window.location.pathname;
const e = path.split("/")[1];

const data = {
  datasets: [
    {
      data: [],
    },
  ],
};

const config = {
  type: "candlestick",
  data,
  options: {
    scales: {
      y: {},
    },
    plugins: { legend: { display: false } },
  },
};

let myChart = new Chart(document.getElementById("myChart"), config);

//returns candlesticks in an array
async function candlesticksForTimeFrame(frameSwitchedTo) {
  try {
    const response = await axios.post(
      `http://localhost:4000/api/${e}/retrieveCandlesForFrame`,
      {
        frameSwitchedTo,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );

    return response.data.candlesticks;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

//call this and pass the time frame when a user switches between frames
async function displayTimeFrameCandlesticks(framePassed) {
  try {
    let arrayOfCandles = await candlesticksForTimeFrame(framePassed);
    console.log("candles for frame", arrayOfCandles);

    let parsedCandles;

    if (arrayOfCandles.length > 1) {
      parsedCandles = arrayOfCandles.map((candle) => ({
        x: Number(candle.open_time),
        o: parseFloat(candle.open),
        h: parseFloat(candle.high),
        l: parseFloat(candle.low),
        c: parseFloat(candle.close),
      }));
      data.datasets[0].data = parsedCandles;
    } else if (arrayOfCandles || typeof arrayOfCandles === "object") {
      data.datasets[0].data = [
        {
          x: Number(arrayOfCandles[0].open_time),
          o: parseFloat(arrayOfCandles[0].open),
          h: parseFloat(arrayOfCandles[0].high),
          l: parseFloat(arrayOfCandles[0].low),
          c: parseFloat(arrayOfCandles[0].close),
        },
      ];
      console.log(
        arrayOfCandles[0].open_time,
        arrayOfCandles[0].open,
        arrayOfCandles[0].high,
        arrayOfCandles[0].low,
        arrayOfCandles[0].close
      );
    }
    myChart.update();
  } catch (error) {
    console.error(error);
  }
}

//add event listeners to buttons to display data when they're clicked
document.getElementById("oneMinute").addEventListener("click", () => {
  displayTimeFrameCandlesticks(60000);
});

document.getElementById("fiveMinutes").addEventListener("click", () => {
  displayTimeFrameCandlesticks(300000);
});

document.getElementById("twentyMinutes").addEventListener("click", () => {
  displayTimeFrameCandlesticks(1.2e6);
});

document.getElementById("oneHour").addEventListener("click", () => {
  displayTimeFrameCandlesticks(3.6e6);
});

document.getElementById("threeHours").addEventListener("click", () => {
  displayTimeFrameCandlesticks(1.08e7);
});

document.getElementById("oneDay").addEventListener("click", () => {
  displayTimeFrameCandlesticks(8.64e7);
});

async function getCurrentPrice() {
  try {
    const response = await axios.post(
      `http://localhost:4000/api/${e}/checkStockPrice`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    console.log(response.data.stockId);
    return response.data.price;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

async function getCandlesOnChart() {
  try {
    const response = await axios.post(
      `http://localhost:4000/api/${e}/checkCandlestickAmount`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    return response.data.candlestickAmount;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

//adds to database as the function says
async function addCandleToDatabase(
  timeFrame,
  openTime,
  openPrice,
  highPrice,
  lowPrice,
  closingPrice,
  candleCreatedAt
) {
  try {
    const response = await axios.post(
      `http://localhost:4000/api/${e}/addCandleStickToDb`,
      {
        timeFrame,
        openTime,
        openPrice,
        highPrice,
        lowPrice,
        closingPrice,
        candleCreatedAt,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    console.log(response.data.stockId);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

class GenerateCandles {
  constructor() {
    this.currentPriceForUserStock = null;
    this.candlesOnChart = null;
    this.candle = null; // store current candle here
  }

  async init() {
    this.currentPriceForUserStock = await getCurrentPrice();
    this.candlesOnChart = await getCandlesOnChart();

    // initialize current candle with current price
    this.candle = {
      x: Date.now(),
      o: this.currentPriceForUserStock,
      h: this.currentPriceForUserStock,
      l: this.currentPriceForUserStock,
      c: this.currentPriceForUserStock,
    };
  }

  async updatePrice() {
    this.currentPriceForUserStock = await getCurrentPrice();
  }

  generateCandlesForTimeFrame(timeFrame) {
    (async () => {
      addCandleToDatabase(
        timeFrame,
        this.candle.x,
        this.candle.o,
        this.candle.h,
        this.candle.l,
        this.candle.c,
        Date.now()
      );

      console.log("created candle for ", timeFrame);

      this.currentPriceForUserStock = await getCurrentPrice();
      this.candle = {
        x: Date.now(),
        o: this.currentPriceForUserStock,
        h: this.currentPriceForUserStock,
        l: this.currentPriceForUserStock,
        c: this.currentPriceForUserStock,
      };

      myChart.update();
      this.candlesOnChart += 1;
      console.log("Initial candle created for", timeFrame, this.candle);
    })();

    // Then set up the interval for future candles
    setInterval(async () => {
      await addCandleToDatabase(
        timeFrame,
        this.candle.x,
        this.candle.o,
        this.candle.h,
        this.candle.l,
        this.candle.c,
        Date.now()
      );

      this.currentPriceForUserStock = await getCurrentPrice();
      this.candle = {
        x: Date.now(),
        o: this.currentPriceForUserStock,
        h: this.currentPriceForUserStock,
        l: this.currentPriceForUserStock,
        c: this.currentPriceForUserStock,
      };

      data.datasets[0].data.push(this.candle);
      myChart.update();
      this.candlesOnChart += 1;
      console.log("New candle created for", timeFrame, this.candle);
    }, timeFrame);
  }

  async updateOnBuyOrSell() {
    await this.updatePrice();

    const lastDataIndex = data.datasets[0].data.length - 1;
    const lastCandle = data.datasets[0].data[lastDataIndex];

    if (this.currentPriceForUserStock > lastCandle.h) {
      lastCandle.h = this.currentPriceForUserStock;
      this.candle.h = this.currentPriceForUserStock;
    }
    if (this.currentPriceForUserStock < lastCandle.l) {
      lastCandle.l = this.currentPriceForUserStock;
      this.candle.l = this.currentPriceForUserStock;
    }
    if (this.currentPriceForUserStock !== lastCandle.c) {
      lastCandle.c = this.currentPriceForUserStock;
      this.candle.c = this.currentPriceForUserStock;
    }

    myChart.update();
  }
}

const generateCandles = new GenerateCandles();

//displays the new stock price every second if at least one trade is made
function needAFunctionNameForThisSoItCanCallItself() {
  if (userTradeWithinCurrentSecond === true) {
    generateCandles.updateOnBuyOrSell();
    userTradeWithinCurrentSecond = false;
  }
  setTimeout(needAFunctionNameForThisSoItCanCallItself, 1000);
}

//iterates through an array of time frames and runs a looping function to constantly add new candlesticks
async function generateCandlesForEACHtimeFrame() {
  //one minute, five minutes, 20 mintues, one hour, three hours, one day, one week
  const timeFrames = [60000, 300000, 1.2e6, 3.6e6, 1.08e7, 8.64e7];

  timeFrames.forEach((frame) =>
    generateCandles.generateCandlesForTimeFrame(frame)
  );
}

//if there are no candles then it goes to that function
document.addEventListener("DOMContentLoaded", async () => {
  await generateCandles.init();

  let candlesOnChart = await getCandlesOnChart();
  if (!candlesOnChart || candlesOnChart == 0) {
    console.log("candle is being created, stock is new", candlesOnChart);
    generateCandlesForEACHtimeFrame();
    displayTimeFrameCandlesticks(60000);
    needAFunctionNameForThisSoItCanCallItself();
  } else {
    console.log("stock is not new", candlesOnChart);
    displayTimeFrameCandlesticks(60000);
    needAFunctionNameForThisSoItCanCallItself(); // Also call it here to check for updates
  }
});

let sharesAvailable;

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

//changes price of the stock
async function changePrice(price) {
  try {
    const response = await axios.post(
      `http://localhost:4000/api/${e}/change-price`,
      { price },
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

async function changePriceOnUserTrade(currencySpent, currencyWasBought) {
  try {
    const placeholder = await getCurrentPrice();
    const sharesBoughtOrSold = currencySpent / placeholder;
    let sharesAvailable; //i need to make a function to call an api to check how many shares are available (and create the endpoint)
    const percentChangedBy =
      Math.round((sharesBoughtOrSold / sharesAvailable) * 0.05 * 100) / 100;

    let newPrice;
    const placeholder1 = await getCurrentPrice();
    userTradeWithinCurrentSecond = true;

    if (currencyWasBought == true) {
      newPrice = placeholder1 * percentChangedBy + placeholder1;
      changePrice(newPrice);
    } else if (currencyWasBought == false) {
      newPrice = placeholder1 * percentChangedBy + placeholder1;
      changePrice(newPrice);
    }
  } catch (error) {
    console.error(error);
  }
}

//event listeners for the html where user makes trade
const buy = document.getElementById("buy");
const sell = document.getElementById("sell");
const invalidTradeText = document.getElementById("invalidTradeText");

async function checkUserCurrencyAmount() {
  try {
    const response = await axios.post(
      `http://localhost:4000/api/check-user-currency-amount`,
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    return response.data.coins.coins;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

async function checkUserHasEnoughCurrency() {
  const userTradeAmount = document.getElementById("userTradeAmount").value;
  const coins = await checkUserCurrencyAmount();
  if (coins < userTradeAmount) {
    invalidTradeText.textContent = "Not enough coins";
    return;
  } else if (Number(userTradeAmount) < 200) {
    invalidTradeText.textContent = "Minimum trade amount is 200 coins";
    return;
  } else {
    invalidTradeText.textContent = "";
    return "valid trade amount";
  }
}

buy.addEventListener("click", async () => {
  const coins = await checkUserCurrencyAmount();
  console.log(coins);
  if ((await checkUserHasEnoughCurrency()) == "valid trade amount") {
    changePriceOnUserTrade(userTradeAmount, true);
  }
});

sell.addEventListener("click", async () => {
  if ((await checkUserHasEnoughCurrency()) == "valid trade amount") {
    changePriceOnUserTrade(userTradeAmount, true);
  }
});

const ws = new WebSocket("ws://localhost:4000");

ws.addEventListener("open", (ws) => {
  console.log("client connected");
});

ws.addEventListener("close", (ws) => {
  console.log("client connected");
});

ws.addEventListener("error", (err) => {
  console.error("WebSocket error:", err);
});

//recieve broadcast from trade to change variable
ws.onmessage = (event) => {
  if (data === "updateValue") {
    userTradeWithinCurrentSecond = true;
  }
};

//make naturally scrollable
const canvas = document.getElementById("myChart");
canvas.width = data.datasets[0].data.length * 100; // 100px per candle
// Instantly assign Chart.js version
const chartVersion = document.getElementById("chartVersion");
chartVersion.innerText = Chart.version;
