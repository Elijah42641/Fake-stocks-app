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

app.listen(4000, () => {
  console.log("Server running on port 4000");
});

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

    await pool.query("INSERT INTO otheraccountdata (username) VALUES ($1)", [
      username,
    ]);

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

//create a variable that will be exported then imported to react file so it can get the price of the stock and other stuff
let idForStock = "";

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
      req.user.idOfStock;
      idForStock = randomStockId;

      // Update user's stock reference
      await pool.query(
        "UPDATE otheraccountdata SET user_stock1 = $1 WHERE username = $2",
        [randomStockId, req.username]
      );

      const randomHTMLFileName = "stock.html";
      const randomReactFileName = "stock.jsx";

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
          randomHTMLFileName,
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
        path.join(stockFolder, randomHTMLFileName),
        `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${stockName}</title>
<link rel="stylesheet" href="stock.css">
</head>
<body>
<script type="module" src="${randomReactFileName}"></script>
</body>
</html>`
      );

      // Write empty React file
      fs.writeFileSync(path.join(stockFolder, randomReactFileName), ``);

      fs.writeFileSync(path.join(stockFolder, "stock.css"), ``);

      console.log("Stock created successfully");
      res.status(200).json({ message: "Stock created successfully" });
    } catch (error) {
      console.error("Error in /api/addstock:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

export const theStockId = idForStock;

app.post("checkStockPrice", async (req, res) => {
  try {
    const idkMoreVariablesICanAssignToStockId = req.session.idOfStock;
    const price = pool.query(
      `SELECT price FROM stocks WHERE stock_id = ${idkMoreVariablesICanAssignToStockId}`
    );

    return res.json({
      price: price,
    });
  } catch (error) {
    console.error(error);
  }
});

app.post("checkCandlestickAmount", async (req, res) => {
  try {
    const idkMoreVariablesICanAssignToStockId123 = req.session.idOfStock;
    const candleSticksOnChart = pool.query(
      `SELECT candles_on_chart FROM stocks WHERE stock_id = ${idkMoreVariablesICanAssignToStockId123}`
    );

    return res.json({
      candlestickAmount: candleSticksOnChart,
    });
  } catch (error) {
    console.error(error);
  }
});
