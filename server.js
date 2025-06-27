import "dotenv/config";
import express from "express";
import { Pool } from "pg";
import bcryptjs from "bcryptjs";
import session from "express-session";
import FileStore from "session-file-store";
import cookieParser from "cookie-parser";
import cors from "cors";
import { WebSocketServer } from "ws";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import { emptyQuery } from "pg-protocol/dist/messages.js";

//to save images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "stock_symbols");
  },
  filename: (req, file, cb) => {
    console.log(file);
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({ storage: storage });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

//so server is shared between backend apis and websocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

//websocket set up
wss.on("connection", (ws) => {
  console.log("new client connected");

  ws.on("close", () => {
    console.log("client disconnected");
  });

  ws.on("error", (err) => {
    console.error("WebSocket error:", err);
  });
});

app.use(
  cors({
    origin: ["http://localhost:4000", "http://localhost:5173"],
    credentials: true,
  })
);

const FileStoreSession = FileStore(session);
app.use(cookieParser());

app.use(
  session({
    name: "usersignin",
    secret: process.env.SESSIONSECRET || "fallback-secret",
    resave: false,
    saveUninitialized: false,
    store: new FileStoreSession({ path: "./sessions" }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: false,
      sameSite: "lax",
    },
  })
);

app.get("/", (req, res) => {
  res.send("Fake Stocks backend is working!");
});

app.use(express.static(path.join(__dirname, "frontend")));

app.use(express.json());

app.use((req, res, next) => {
  console.log("Session:", req.session);
  next();
});

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "fake-stock-app",
  password: process.env.PASSWORD,
  port: 5432,
});

app.get("/favicon.ico", (req, res) => res.status(204).end());

// API endpoint for creating account (use when you start adding authentication)
app.post("/api/createaccount", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        code: 1000,
        message: "All fields are required",
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 12);
    console.log("password successfully hashed");

    // Check username
    const usernameUsed = await pool.query(
      "SELECT username FROM accountcredentials WHERE username = $1",
      [username]
    );

    if (usernameUsed.rows.length > 0) {
      return res.status(409).json({
        code: 1002,
        message: "Username exists",
      });
    }

    console.log("inserting data...");

    // Create new account
    await pool.query(
      "INSERT INTO accountcredentials (username,password) VALUES ($1, $2)",
      [username, hashedPassword]
    );

    await pool.query(
      "INSERT INTO otheraccountdata (username, coins) VALUES ($1, $2)",
      [username, 500]
    );

    console.log("data successfully inserted");

    req.session.user = { username: username };
    console.log("cookie created");

    return res.status(200).json({
      success: true,
      message: "Account created successfully",
      username: username,
    });
  } catch (err) {
    console.error("Create account error:", err);
    res.status(500).json({
      code: 1003,
      message: "Internal server error",
      error: err.message,
    });
  }
});

// Fixed signin endpoint (use when you start adding authentication)
app.post("/api/signin", async (req, res) => {
  try {
    const { username, password } = req.body;

    // Get user from database
    const userResult = await pool.query(
      "SELECT password FROM accountcredentials WHERE username = $1",
      [username]
    );

    // Check if user exists
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Compare passwords
    const storedHash = userResult.rows[0].password;
    const doesDataMatch = await bcryptjs.compare(password, storedHash);

    if (!doesDataMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    req.session.user = { username: username };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        return res.status(500).json({
          success: false,
          message: "Session save failed",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Login successful",
        username: username,
      });
    });
  } catch (err) {
    console.error("Signin error:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
});

//for redirecting if not signed in
app.post("/api/usersignedin", async (req, res) => {
  try {
    if (!req.session.user || req.session.user === undefined) {
      return res.status(401).json({
        message: "user unauthorized",
      });
    }
    return res.json({
      username: req.session.user,
    });
  } catch (err) {
    if (err === 401) {
      return res.status(401).json({
        message: "user unauthorized",
      });
    }
    console.error(err);
  }
});

//submit stock data
app.post(
  "/api/addstock",

  // Middleware 1: session & user check
  (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res
        .status(401)
        .json({ message: "Session expired, please login again" });
    }
    req.username = req.session.user.username;
    next();
  },

  // Middleware 2: check if user can add stock, set req.canUpload accordingly
  async (req, res, next) => {
    try {
      const result = await pool.query(
        "SELECT user_stock1 FROM otheraccountdata WHERE username = $1",
        [req.username]
      );

      if (result.rows.length > 0 && result.rows[0].user_stock1 !== null) {
        req.canUpload = false;
        return res.status(429).json({
          message: "Can't create more than one stock on a single account",
        });
      }
      req.canUpload = true;
      next();
    } catch (err) {
      console.error("DB error checking stock:", err);
      res.status(500).json({ message: "Database error" });
    }
  },

  // Middleware 3: multer upload (runs only if req.canUpload is true)
  (req, res, next) => {
    upload.single("stockImage")(req, res, function (err) {
      if (err) {
        console.error("Upload error:", err.message);
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },

  // Middleware 4: main handler that inserts stock and creates files
  async (req, res) => {
    try {
      const { stockName, stockAbbreviation, description, initialPrice } =
        req.body;

      if (!stockName || !stockAbbreviation || !initialPrice) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Generate random stock ID
      const randomStockId = Math.floor(Math.random() * 1e14);

      //save session
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to save session" });
        }
      });

      idForStock = randomStockId;

      // Update user's stock reference
      await pool.query(
        "UPDATE otheraccountdata SET user_stock1 = $1 WHERE username = $2",
        [randomStockId, req.username]
      );

      const fileName = req.file.filename;

      // Insert stock data
      await pool.query(
        `INSERT INTO stocks (stock_id, stock_name, stock_abbreviation, stock_img_file_name, stock_description, price, html_file_name) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          randomStockId,
          stockName,
          stockAbbreviation,
          fileName,
          description,
          initialPrice,
          "stock.html",
        ]
      );

      // Create folder for the new stock
      const stockFolder = path.join(
        __dirname,
        "frontend",
        randomStockId.toString()
      );
      if (!fs.existsSync(stockFolder)) {
        fs.mkdirSync(stockFolder);
      }

      fs.writeFileSync(
        path.join(stockFolder, "stock.html"),
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${stockName}</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        font-family: sans-serif;
      }
      .chartMenu {
        width: 100vw;
        height: 40px;
        background: #1a1a1a;
        color: rgba(54, 162, 235, 1);
      }
      .chartMenu p {
        padding: 10px;
        font-size: 20px;
      }
      .chartCard {
        width: 100vw;
        height: calc(100vh - 40px);
        background: rgba(54, 162, 235, 0.2);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .chartBox {
        width: 700px;
        padding: 20px;
        border-radius: 20px;
        border: solid 3px rgba(54, 162, 235, 1);
        background: white;
      }

      .gridContainerForTimeFrame {
        padding: 10px;
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: center;
        background-color: #222;
      }

      .timeFrame {
        padding: 8px 16px;
        background: #1a1a1a;
        color: white;
        border: 1px solid rgba(54, 162, 235, 0.8);
        border-radius: 6px;
        cursor: pointer;
      }

      #trade-prompt {
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
        background: white;
        padding: 20px;
        width: 300px;
        margin: 20px auto;
        text-align: center;
        border: 2px solid rgba(54, 162, 235, 1);
        border-radius: 12px;
      }

      #trade-prompt.visible {
        opacity: 1;
        pointer-events: auto;
      }

      #trade-prompt.hidden {
        display: none;
      }

      #trade-cta {
        display: block;
        margin: 20px auto;
        padding: 10px 20px;
        background: #1a1a1a;
        color: white;
        border: 1px solid rgba(54, 162, 235, 1);
        border-radius: 6px;
        cursor: pointer;
      }
    </style>
  </head>

  <body>
    <div class="chartMenu">
      <p>WWW.FAKESTOCKS.COM (Chart JS <span id="chartVersion"></span>)</p>
    </div>

    <div class="chartCard">
      <div class="chartBox">
        <canvas id="myChart"></canvas>
      </div>
    </div>

    <div class="gridContainerForTimeFrame">
      <button class="timeFrame" id="oneMinute">1 minute</button>
      <button class="timeFrame" id="fiveMinutes">5 minutes</button>
      <button class="timeFrame" id="twentyMinutes">20 minutes</button>
      <button class="timeFrame" id="oneHour">1 hour</button>
      <button class="timeFrame" id="threeHours">3 hours</button>
      <button class="timeFrame" id="oneDay">1 day</button>
      <button class="timeFrame" id="oneWeek">1 week</button>
    </div>

    <button id="trade-cta">Make a Trade</button>

    <div id="trade-prompt" class="hidden">
      <h2>New Trade</h2>
      <input id="userTradeAmount" type="number" placeholder="Enter amount" />
      <p id="invalidTradeText"></p>
      <button id="sell">Sell</button>
      <button id="buy">Buy</button>
    </div>

    <!-- JS Dependencies -->
    <script src="https://cdn.jsdelivr.net/npm/axios/dist/axios.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-chart-financial@0.2.1/dist/chartjs-chart-financial.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/luxon/build/global/luxon.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon"></script>
    <script>
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

      new Chart(document.getElementById("myChart"), config);
    </script>
    <script type="module" src="stock.js"></script>

    <script>
      const cta = document.getElementById("trade-cta");
      const prompt = document.getElementById("trade-prompt");

      cta.addEventListener("click", () => {
        prompt.classList.remove("hidden");
        setTimeout(() => {
          prompt.classList.add("visible");
        }, 10);
      });
    </script>
  </body>
</html>
`
      );

      // Write js file
      fs.writeFileSync(
        path.join(stockFolder, "stock.js"),
        `let userTradeWithinCurrentSecond;
          let currentPriceForUserStock;

//returns candlesticks in an array
async function candlesticksForTimeFrame(frameSwitchedTo) {
  try {
    const response = await axios.post(
      "http://localhost:4000/api/retrieveCandlesForFrame",
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

    return response.data.candlesticks.rows;
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
    const arrayOfCandles = await candlesticksForTimeFrame(framePassed);
    data.datasets[0].data.length = 0;
    arrayOfCandles.forEach((candleInFrame) =>
      data.datasets[0].data.push(candleInFrame)
    );
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

document.getElementById("oneWeek").addEventListener("click", () => {
  displayTimeFrameCandlesticks(6.048e8);
});

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
    return response.data.price.rows;
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
    return response.data.candlestickAmount.rows;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
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
    data.datasets[0].data[data.datasets[0].data.length - 1].c =
      currentPriceForUserStock;
    myChart.update();
  }
}

//displays the new stock price every second if at least one trade is made
function needAFunctionNameForThisSoItCanCallItself() {
  if (userTradeWithinCurrentSecond == true) {
    updateOnBuyOrSell();
    userTradeWithinCurrentSecond = false;
    setTimeout(needAFunctionNameForThisSoItCanCallItself, 1000);
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

  setTimeout(() => {
    //adds the candle before new one is created
    addCandleToDatabase(
      timeFrame,
      candle.x,
      candle.o,
      candle.h,
      candle.l,
      candle.c,
      Date.now()
    );
    generateCandlesForTimeFrame(timeFrame);
  }, timeFrame);
  candlesOnChart += 1;
  myChart.update();
}

//iterates through an array of time frames and runs a looping function to constantly add new candlesticks
async function generateCandlesForEACHtimeFrame() {
  //one minute, five minutes, 20 mintues, one hour, three hours, one day, one week
  const timeFrames = [60000, 300000, 1.2e6, 3.6e6, 1.08e7, 8.64e7, 6.048e8];

  timeFrames.forEach((frame) => generateCandlesForTimeFrame(frame));
}

//if there are no candles then it goes to that function
document.addEventListener("DOMContentLoaded", async () => {
  console.log("page loaded");
  let candlesOnChart = await getCandlesOnChart();
  if (!candlesOnChart || candlesOnChart == null || candlesOnChart == 0) {
    console.log("candle is being created");
    displayTimeFrameCandlesticks(60000);
    generateCandlesForEACHtimeFrame();
    needAFunctionNameForThisSoItCanCallItself();
  }
    else {
    console.log('stock is not new', );
  }
});

let sharesAvailable;

async function getSharesAvailable() {
  try {
    const response = await axios.post(
      "http://localhost:4000/api/checkSharesAvailable",
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    return response.data.shares.rows;
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("redirect");
      window.location.href = "../signinpage/signin.html";
    } else {
      console.error(error);
    }
  }
}

//changes price of the stock
async function changePrice(price) {
  try {
    const response = await axios.post(
      "http://localhost:4000/api/change-price",
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
    sharesAvailable = await getSharesAvailable();
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
const userTradeAmount = document.getElementById("userTradeAmount").value;
const buy = document.getElementById("buy");
const sell = document.getElementById("sell");
const invalidTradeText = document.getElementById("invalidTradeText");

async function checkUserCurrencyAmount() {
  try {
    const response = await axios.post(
      "http://localhost:4000/api/check-user-currency-amount",
      {},
      {
        headers: {
          "Content-Type": "application/json",
        },
        withCredentials: true,
      }
    );
    return response.data.coins.rows;
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
  const coins = await checkUserCurrencyAmount();
  if (coins < userTradeAmount) {
    invalidTradeText.textContent = "Not enough coins";
    return;
  } else if (userTradeAmount < 200) {
    invalidTradeText.textContent = "Minimum trade amount is 200 coins";
    return;
  } else {
    invalidTradeText.textContent = "";
    return "valid trade amount";
  }
}

buy.addEventListener("click", async () => {
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
`
      );

      //make css file
      fs.writeFileSync(
        path.join(stockFolder, "stock.css"),
        `.chart-container {
  width: 100%;
  max-width: 800px; /* adjust based on your layout */
  overflow-x: auto;
  border: 2px solid #444;
  background: #111;
  padding: 10px;
}

.chart-scroll {
  width: 1500px; /* make this wider than the container */
}
`
      );

      console.log("Stock created successfully");
      res.status(200).json({ message: "Stock created successfully" });
    } catch (error) {
      console.error("Error in /api/addstock:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

app.post("/api/:stockId/checkStockPrice", async (req, res) => {
  try {
    const stockId = req.params.stockId;

    if (!stockId) {
      return res.status(400).json({ message: "Stock ID not found in session" });
    }

    const result = await pool.query(
      `SELECT price FROM stocks WHERE stock_id = $1`,
      [stockId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Stock not found" });
    }

    return res.json({
      price: result.rows[0].price,
      stockId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/:stockId/checkCandlestickAmount", async (req, res) => {
  try {
    const idkMoreVariablesICanAssignToStockId123 = req.params.stockId;
    const candleSticksOnChart = await pool.query(
      `SELECT candles_on_chart FROM stocks WHERE stock_id = ${idkMoreVariablesICanAssignToStockId123}`
    );

    return res.json({
      candlestickAmount: candleSticksOnChart.rows[0].candles_on_chart,
    });
  } catch (error) {
    console.error(error);
  }
});

app.post("/api/:stockId/addCandleStickToDb", async (req, res) => {
  try {
    const {
      timeFrame,
      openTime,
      openPrice,
      highPrice,
      lowPrice,
      closingPrice,
    } = req.body;

    const idkMoreVariablesICanAssignToStockId1233333333 = req.params.stockId;
    console.log("stock id:", idkMoreVariablesICanAssignToStockId1233333333);
    const response = await pool.query(
      `INSERT INTO candlesticks (
        stock_id, timeframe, open_time, open, high, low, close
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        idkMoreVariablesICanAssignToStockId1233333333,
        timeFrame,
        openTime,
        openPrice,
        highPrice,
        lowPrice,
        closingPrice,
      ]
    );
    await pool.query(
      `UPDATE stocks 
       SET candles_on_chart = candles_on_chart + 1 
       WHERE stock_id = $1`,
      [idkMoreVariablesICanAssignToStockId1233333333]
    );
  } catch (error) {
    console.error(error);
  }
});

app.post("/api/:stockId/retrieveCandlesForFrame", async (req, res) => {
  try {
    const { frameSwitchedTo } = req.body;
    const idkMoreVariablesICanAssignToStockId1235545454545 = req.params.stockId;
    const candlesticksForTimeFrame = await pool.query(
      `SELECT *
FROM candlesticks
WHERE stock_id = $1 AND timeframe = $2
ORDER BY open_time ASC;`,
      [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
    );

    //makes an else if statement to see if the amount of candles for the stock has reached the max amount of candles and clears the oldest
    if (
      candlesticksForTimeFrame.rows.length >= 600 &&
      frameSwitchedTo === 60000
    ) {
      await pool.query(
        `DELETE FROM candlesticks
         WHERE id = (
           SELECT id FROM candlesticks
           WHERE stock_id = $1 AND timeframe = $2
           ORDER BY open_time ASC
           LIMIT 1
         )`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );

      candlesticksForTimeFrame = await pool.query(
        `SELECT *
FROM candlesticks
WHERE stock_id = $1 AND timeframe = $2
ORDER BY open_time ASC;`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );
    } else if (
      candlesticksForTimeFrame.rows.length >= 550 &&
      frameSwitchedTo === 300000
    ) {
      await pool.query(
        `DELETE FROM candlesticks
         WHERE id = (
           SELECT id FROM candlesticks
           WHERE stock_id = $1 AND timeframe = $2
           ORDER BY open_time ASC
           LIMIT 1
         )`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );

      candlesticksForTimeFrame = await pool.query(
        `SELECT *
FROM candlesticks
WHERE stock_id = $1 AND timeframe = $2
ORDER BY open_time ASC;`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );
    } else if (
      candlesticksForTimeFrame.rows.length >= 500 &&
      frameSwitchedTo === 1.2e6
    ) {
      await pool.query(
        `DELETE FROM candlesticks
         WHERE id = (
           SELECT id FROM candlesticks
           WHERE stock_id = $1 AND timeframe = $2
           ORDER BY open_time ASC
           LIMIT 1
         )`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );

      candlesticksForTimeFrame = await pool.query(
        `SELECT *
FROM candlesticks
WHERE stock_id = $1 AND timeframe = $2
ORDER BY open_time ASC;`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );
    } else if (
      candlesticksForTimeFrame.rows.length >= 500 &&
      frameSwitchedTo === 3.6e6
    ) {
      await pool.query(
        `DELETE FROM candlesticks
         WHERE id = (
           SELECT id FROM candlesticks
           WHERE stock_id = $1 AND timeframe = $2
           ORDER BY open_time ASC
           LIMIT 1
         )`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );

      candlesticksForTimeFrame = await pool.query(
        `SELECT *
FROM candlesticks
WHERE stock_id = $1 AND timeframe = $2
ORDER BY open_time ASC;`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );
    } else if (
      candlesticksForTimeFrame.rows.length >= 450 &&
      frameSwitchedTo === 1.08e7
    ) {
      await pool.query(
        `DELETE FROM candlesticks
         WHERE id = (
           SELECT id FROM candlesticks
           WHERE stock_id = $1 AND timeframe = $2
           ORDER BY open_time ASC
           LIMIT 1
         )`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );

      candlesticksForTimeFrame = await pool.query(
        `SELECT *
FROM candlesticks
WHERE stock_id = $1 AND timeframe = $2
ORDER BY open_time ASC;`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );
    } else if (
      candlesticksForTimeFrame.rows.length >= 400 &&
      frameSwitchedTo === 8.64e7
    ) {
      await pool.query(
        `DELETE FROM candlesticks
         WHERE id = (
           SELECT id FROM candlesticks
           WHERE stock_id = $1 AND timeframe = $2
           ORDER BY open_time ASC
           LIMIT 1
         )`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );

      candlesticksForTimeFrame = await pool.query(
        `SELECT *
FROM candlesticks
WHERE stock_id = $1 AND timeframe = $2
ORDER BY open_time ASC;`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );
    } else if (
      candlesticksForTimeFrame.rows.length >= 400 &&
      frameSwitchedTo === 6.048e8
    ) {
      await pool.query(
        `DELETE FROM candlesticks
         WHERE id = (
           SELECT id FROM candlesticks
           WHERE stock_id = $1 AND timeframe = $2
           ORDER BY open_time ASC
           LIMIT 1
         )`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );

      candlesticksForTimeFrame = await pool.query(
        `SELECT *
FROM candlesticks
WHERE stock_id = $1 AND timeframe = $2
ORDER BY open_time ASC;`,
        [idkMoreVariablesICanAssignToStockId1235545454545, frameSwitchedTo]
      );
    }

    return res.json({
      candlesticks: candlesticksForTimeFrame.rows,
      stockId: idkMoreVariablesICanAssignToStockId1235545454545,
    });
  } catch (error) {
    console.error(error);
  }
});

app.post("/api/:stockId/change-price", async (req, res) => {
  try {
    const { price } = req.body;
    const idkMoreVariablesICanAssignToStockId93577234587878787878 =
      req.params.stockId;
    const changeStockPrice = await pool.query(
      `  UPDATE stocks 
  SET price = $1
  WHERE stock_id = $2 `,
      [price, idkMoreVariablesICanAssignToStockId93577234587878787878]
    );

    //broadcast variable change
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("there was a trade fr");
      }
    });
  } catch (error) {
    console.error(error);
  }
});

app.post("/api/check-user-currency-amount", async (req, res) => {
  try {
    if (!req.session.user || req.session.user === undefined) {
      return res.status(401);
    }

    const username = req.session.user.username;
    const coins = await pool.query(
      `SELECT coins FROM otheraccountdata WHERE username = $1`,
      [username]
    );
    return res.json({
      coins: coins.rows[0],
      username: username,
    });
  } catch (error) {
    console.error(error);
  }
});

server.listen(4000, () => {
  console.log("Server running on port 4000");
});
