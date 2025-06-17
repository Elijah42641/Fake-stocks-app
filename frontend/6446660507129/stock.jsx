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

//make a function that adds a new candle based on the time period and stops updating the last candle when new candle is created
//when you get that start saving the candles for specific time periods to the db

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

let currentPriceForUserStock = getCurrentPrice();
let candlesOnChart = getCandlesOnChart();

function addUpdatingCandle() {
  const candle = {
    x: Date.now(),
    o: currentPriceForUserStock,
    h: currentPriceForUserStock,
    l: currentPriceForUserStock,
    c: currentPriceForUserStock,
  };

  data.datasets.data.push(candle);
  candlesOnChart += 1;
  myChart.update();
}

function updateOnBuyOrSell() {
  currentPriceForUserStock = getCurrentPrice();
  if (
    currentPriceForUserStock >
    data.datasets.data[data.datasets.data.length - 1].h
  ) {
    data.datasets.data[data.datasets.data.length - 1].h =
      currentPriceForUserStock;
    myChart.update();
  } else if (
    currentPriceForUserStock <
    data.datasets.data[data.datasets.data.length - 1].l
  ) {
    data.datasets.data[data.datasets.data.length - 1].l =
      currentPriceForUserStock;
    myChart.update();
  } else if (
    currentPriceForUserStock >
    data.datasets.data[data.datasets.data.length - 1].c
  ) {
    data.datasets.data[data.datasets.data - 1].c = currentPriceForUserStock;
    myChart.update();
  } else if (
    currentPriceForUserStock <
    data.datasets.data[data.datasets.data.length - 1].c
  ) {
    data.datasets.data[data.datasets.data - 1].c = currentPriceForUserStock;
    myChart.update();
  }
} //run this function when user buys or sells a stock

if (candlesOnChart == false) {
  addUpdatingCandle();
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
