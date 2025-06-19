// setup
import { theStockId } from "../../server";
import { Chart, TimeScale, LinearScale, Tooltip, Legend } from "chart.js";
import {
  CandlestickController,
  CandlestickElement,
} from "chartjs-chart-financial";
import { DateTime } from "luxon";
import "chartjs-adapter-luxon";

// Register Chart.js components
Chart.register(TimeScale, LinearScale, Tooltip, Legend);

// Register financial chart controllers and elements
Chart.register(CandlestickController, CandlestickElement);

const data = {
  datasets: [
    {
      barThickness: 18,
      data: [],
    },
  ],
};

//display candles when you switch between time frames
//start having the user trades actually effect the candles

async function getCurrentPrice() {
  try {
    const response = await axios.post(
      "http://localhost:4000/api/checkStockPrice",
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    return response.price;

    if (response.status === 401) {
      window.location.href = "../signinpage/signin.html";
    }
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
      "http://localhost:4000/api/checkCandlestickAmount",
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    return response.candlestickAmount;

    if (response.status === 401) {
      window.location.href = "../signinpage/signin.html";
    }
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

let currentPriceForUserStock = await getCurrentPrice();
let candlesOnChart = await getCandlesOnChart();

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
      "http://localhost:4000/api/addCandleStickToDb",
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
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

//generates candles for time frame given
function generateCandlesForTimeFrame(timeFrame) {
  const candle = {
    x: Date.now(),
    o: currentPriceForUserStock,
    h: currentPriceForUserStock,
    l: currentPriceForUserStock,
    c: currentPriceForUserStock,
  };

  data.datasets[0].data.push(candle);
  candlesOnChart += 1;

  setTimeout(() =>
    generateCandlesForTimeFrame(
      //adds the candle before new one is created
      addCandleToDatabase(
        timeFrame,
        openTime,
        openPrice,
        highPRice,
        lowPrice,
        closingPrice,
        candleCreatedAt
      ),
      timeFrame
    )
  );
  myChart.update();
}

async function updateOnBuyOrSell() {
  currentPriceForUserStock = await getCurrentPrice();
  if (
    currentPriceForUserStock >
    data.datasets[0].data[data.datasets[0].data.length - 1].h
  ) {
    data.datasets[0].data[data.datasets[0].data.length - 1].h =
      currentPriceForUserStock;
    myChart.update();
  } else if (
    currentPriceForUserStock <
    data.datasets[0].data[data.datasets[0].data.length - 1].l
  ) {
    data.datasets[0].data[data.datasets[0].data.length - 1].l =
      currentPriceForUserStock;
    myChart.update();
  } else if (
    currentPriceForUserStock >
    data.datasets[0].data[data.datasets[0].data.length - 1].c
  ) {
    data.datasets[0].data[data.datasets[0].data - 1].c =
      currentPriceForUserStock;
    myChart.update();
  } else if (
    currentPriceForUserStock <
    data.datasets[0].data[data.datasets[0].data.length - 1].c
  ) {
    data.datasets[0].data[data.datasets[0].data - 1].c =
      currentPriceForUserStock;
    myChart.update();
  }
} //run this function when user buys or sells a stock

//iterates through an array of time frames and runs a looping function to constantly add new candlesticks
async function generateCandlesForEACHtimeFrame() {
  //one minute, five minutes, 20 mintues, one hour, three hours, one day, one week
  const timeFrames = [60000, 300000, 1.2e6, 3.6e6, 1.08e7, 8.64e7, 6.048e8];

  timeFrames.forEach((frame) => generateCandlesForTimeFrame(frame));
}

//if there are no candles then it goes to that function
if (!candles) {
  generateCandlesForEACHtimeFrame();
}

// config
const config = {
  type: "candlestick",
  data,
  options: {
    scales: {
      x: {
        type: "time",
        time: { unit: "day" },
        ticks: { color: "#fff" },
      },
      y: {
        ticks: { color: "#fff" },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
    },
  },
};

//make naturally scrollable
const canvas = document.getElementById("myChart");
canvas.width = data.datasets[0].data.length * 100; // 100px per candle

// render init block
const myChart = new Chart(document.getElementById("myChart"), config);

// Instantly assign Chart.js version
const chartVersion = document.getElementById("chartVersion");
chartVersion.innerText = Chart.version;
