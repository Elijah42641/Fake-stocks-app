import 'dotenv/config';
import express from 'express';
import { Pool } from 'pg';
import bcryptjs from 'bcryptjs';
import session from "express-session";
import FileStore from "session-file-store";
import cookieParser from "cookie-parser";
import cors from 'cors';
import { WebSocketServer } from "ws";
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

//so server is shared between backend apis and websocket
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  console.log("new client connected");

  ws.on('close', () => {
    console.log("client disconnected");
  });

  ws.on('error', err => {
    console.error("WebSocket error:", err); // <-- Error log
  });
});


app.use(cors({
  origin: 'http://localhost:4000',
  credentials: true
}));

const FileStoreSession = FileStore(session);
app.use(cookieParser());

app.use(
  session({
    name: "usersignin",
    secret: process.env.SESSIONSECRET || 'fallback-secret',
    resave: false,
    saveUninitialized: false,
    store: new FileStoreSession({ path: "./sessions" }),
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      httpOnly: true,
      secure: false, 
      sameSite: 'lax',
    }
  })
);

app.get('/', (req, res) => {
  res.send('Fake Stocks backend is working!');
});

app.use(express.static(path.join(__dirname, 'frontend')));

app.use(express.json());

app.listen(4000, () => {
  console.log("Server running on port 4000");
});

app.use((req, res, next) => {
  console.log('Session:', req.session);
  next();
});


const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'fake-stock-app',
  password: process.env.PASSWORD,
  port: 5432,
});


app.get('/favicon.ico', (req, res) => res.status(204).end());

// API endpoint for creating account (use when you start adding authentication)
app.post('/api/createaccount', async (req, res) => {
try {
    const { username,password } = req.body;
    
    // Validate input
    if (!username || !password) {
      return res.status(400).json({
        code: 1000,
        message: "All fields are required"
      });
    }

    const hashedPassword = await bcryptjs.hash(password, 12);
    console.log("password successfully hashed");

    // Check username 
    const usernameUsed = await 
      pool.query('SELECT username FROM accountcredentials WHERE username = $1', [username]);

    if (usernameUsed.rows.length > 0) {
      return res.status(409).json({
        code: 1002,
        message: "Username exists"
      });
    }


    console.log("inserting data...");

    // Create new account
    await pool.query(
      'INSERT INTO accountcredentials (username,password) VALUES ($1, $2)',
      [username, hashedPassword]
    );

       await pool.query(
      'INSERT INTO otheraccountdata (username) VALUES ($1)',
      [username]
    );

    console.log("data successfully inserted");

    req.session.user = { username:username};
    console.log("cookie created");


    return res.status(200).json({
      success: true,
      message: "Account created successfully",
     username: username
    });

  } catch (err) {
  console.error('Create account error:', err);
  res.status(500).json({
    code: 1003,
    message: "Internal server error",
    error: err.message, 
  });
}
});

// Fixed signin endpoint (use when you start adding authentication)
app.post('/api/signin', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Get user from database
    const userResult = await pool.query(
      'SELECT password FROM accountcredentials WHERE username = $1',
      [username]
    );

    // Check if user exists
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Compare passwords
    const storedHash = userResult.rows[0].password;
    const doesDataMatch = await bcryptjs.compare(password, storedHash);
    
    if (!doesDataMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
   
    req.session.user = { username:username};

 req.session.save(err => {
  if (err) {
    console.error('Session save error:', err);
    return res.status(500).json({
      success: false,
      message: 'Session save failed'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Login successful',
    username: username
  });
});

  } catch (err) {
    console.error('Signin error:', err);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

//for redirecting if not signed in
app.post('/api/usersignedin', async(req, res) => {
  try {
   if (!req.session.user || req.session.user===undefined) {
    return res.status(401).json({
      message:'user unauthorized'
    }
    );
   }
   return res.json({
    username:req.session.user
  });
  }

  catch(err) {
    if (err===401) {
      return res.status(401).json({
        message:'user unauthorized'
      });
    }
    console.error(err) 
  }
})

