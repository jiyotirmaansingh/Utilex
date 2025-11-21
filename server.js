// 📦 Import Core Modules and Packages
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
const contactRouter = require("./routes/contact.route");
const helmet = require("helmet");
require("dotenv").config();

// 📦 Import Custom Modules
const userRouter = require("./routes/user.route");
const verifyToken = require("./middlewares/verifyToken");
const Message = require("./models/Message");

// Github Auth
const session = require("express-session");
const passport = require("passport");
require("./middlewares/passport");
const githubAuthRouter = require("./routes/github.route");

// 🚀 App and Server Setup
const app = express();
const server = http.createServer(app);

// Read env vars (use uppercase conventional names)
const PORT = process.env.PORT || 8080;
const MONGO_URL = process.env.MONGO_URL || process.env.mongoURL;
const JWT_SECRET = process.env.JWT_SECRET || "dev_jwt_secret";
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.session_secret || "dev_session_secret";
const FRONTEND_URL = process.env.FRONTEND_URL || process.env.FRONTEND || "http://localhost:3000"; // used for CORS (set this to your Vercel URL)

// 🌐 Configure Socket.IO with CORS to allow only frontend origin
const io = new Server(server, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// 🧩 Middlewares
// Restrict CORS to only your frontend in production
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
  })
);

app.use(express.json()); // only once
app.use(express.urlencoded({ extended: true }));

// Serve static frontend (if you still want backend to serve public during local dev)
app.use(express.static(path.join(__dirname, "public")));

// Github Auth
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production", // set secure cookies in prod
      httpOnly: true,
      sameSite: "lax",
    },
  })
);
app.use(passport.initialize());
app.use(passport.session());
app.use("/auth", githubAuthRouter);

// Nodemailer / Contact route
app.use("/api/contact", contactRouter);

// MongoDB connect
if (!MONGO_URL) {
  console.error("❌ MONGO_URL is not set. Set process.env.MONGO_URL before starting.");
  process.exit(1);
}
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Failed:", err);
    process.exit(1);
  });

// API routes
app.use("/api/user", userRouter);

// Protected Profile Route (JWT)
app.get("/profile", verifyToken, (req, res) => {
  res.json({ name: req.user.name });
});

// 🌐 WebSocket (Socket.IO) Logic
let onlineUsers = {};

io.on("connection", (socket) => {
  // helpful debug log for each new socket
  console.log(`🔌 Socket connected: ${socket.id}`);

  // 🟢 User joins a room
  socket.on("joinRoom", ({ username, room }) => {
    socket.join(room);
    socket.username = username;
    socket.room = room;

    onlineUsers[socket.id] = username;

    // 👥 Update user list to all clients
    io.emit("userList", onlineUsers);

    // 📢 Notify others in room
    socket.to(room).emit("welcome", `${username} joined room: ${room}`);
  });

  // 💬 Handle incoming chat messages
  socket.on("gyan", async (msg) => {
    try {
      const message = new Message({
        username: socket.username,
        room: socket.room,
        content: msg,
      });
      await message.save();

      io.to(socket.room).emit("chatMessage", {
        username: socket.username,
        content: msg,
        timestamp: new Date(),
      });
    } catch (err) {
      console.error("Error saving message:", err);
    }
  });

  // ✍️ Typing Indicator
  socket.on("typing", () => {
    socket.to(socket.room).emit("typing", `${socket.username} is typing...`);
  });

  socket.on("stopTyping", () => {
    socket.to(socket.room).emit("stopTyping");
  });

  // 📩 Room Invitation
  socket.on("inviteToRoom", ({ targetSocketId, room }) => {
    io.to(targetSocketId).emit("roomInvite", {
      room,
      from: socket.username,
    });
  });

  // ✅ Accept Room Invitation
  socket.on("acceptInvite", ({ room }) => {
    socket.join(room);
    socket.room = room;

    socket.to(room).emit("welcome", `${socket.username} joined the room`);
  });

  // 🔴 User Disconnects
  socket.on("disconnect", () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
    delete onlineUsers[socket.id];
    io.emit("userList", onlineUsers);
  });
});

// 🚀 Start the Server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    "https://cdn.tailwindcss.com",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com",
    "https://cdn.socket.io",
    "https://cdn.jsdelivr.net",
    "https://cdn.jsdelivr.net/npm/sweetalert2@11",
    "https://kit.fontawesome.com"
  ],
  connectSrc: [
    "'self'",
    process.env.FRONTEND_URL || "http://localhost:3000",
    // backend origin for sockets & api
    process.env.BACKEND_URL || process.env.FRONTEND_URL || process.env.FRONTEND || "https://utilex.onrender.com",
    // allow wss to backend domain
    `wss://${(process.env.BACKEND_DOMAIN || (process.env.FRONTEND_URL && new URL(process.env.FRONTEND_URL).hostname) || 'utilex.onrender.com')}`,
    "https://api.github.com",
    "https://raw.githubusercontent.com"
  ],
  imgSrc: [
    "'self'",
    "data:",
    "blob:",
    "https://images.unsplash.com",
    "https://avatars.githubusercontent.com",
    "https://cdn.jsdelivr.net"
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    "https://cdn.jsdelivr.net",
    "https://cdnjs.cloudflare.com"
  ],
  fontSrc: [
    "'self'",
    "data:",
    "https://cdnjs.cloudflare.com",
    "https://cdn.jsdelivr.net"
  ],
  // you can restrict frameAncestors via header (helmet will set it)
  frameAncestors: ["'self'"],
  baseUri: ["'self'"]
};

// apply helmet with CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: cspDirectives
    }
  })
);
