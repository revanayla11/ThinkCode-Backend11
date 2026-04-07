require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const dashboardRoutes = require("./routes/dashboardRoutes");
const models = require("./models"); 




const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://thinkcode-vol1.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],  
  allowedHeaders: ["Content-Type", "Authorization"]  
}));

app.use((req, res, next) => {
  console.log("CORS Debug - Origin:", req.headers.origin, "Method:", req.method);
  next();
});

app.use(express.json());
app.use(express.json({ limit: '10mb' }));  
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));


// routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/static", require("./routes/staticRoutes"));
app.use("/api/materi", require("./routes/materiRoutes"));
app.use("/api/leaderboard", require("./routes/leaderboardRoutes"));
app.use("/api/achievement", require("./routes/achievementRoutes"));
app.use("/api/game", require("./routes/gameRoutes"));
app.use("/api/discussion", require("./routes/discussionRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/badges", require("./routes/badgeRoutes")); 
app.use("/api/profile", require("./routes/profileRoutes"));



// admin routes
app.use("/api/admin/users", require("./routes/admin/userAdminRoutes"));
app.use("/api/admin/materi", require("./routes/admin/materiAdminRoutes"));
app.use("/api/admin/submissions", require("./routes/admin/submissionAdminRoutes"));
app.use("/api/admin/discussion", require("./routes/admin/discussionAdminRoutes"));
app.use("/api/admin/achievement", require("./routes/admin/achievementAdminRoutes"));
app.use("/api/admin/leaderboard", require("./routes/admin/leaderboardAdminRoutes"));
app.use("/api/admin/minigame", require("./routes/admin/miniGameAdminRoutes"));
app.use("/api/admin/profile", require("./routes/admin/adminProfileRoutes"));
app.use("/api/admin/badges", require("./routes/admin/badgeAdminRoutes"));
app.use("/api/feedback", require("./routes/feedback"));
app.use("/api/admin", require("./routes/admin/adminRoutes"));
app.use("/api/admin/students", require("./routes/admin/studentAdminRoutes")); 

app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    etag: false,
    lastModified: false,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".mp4")) {
        res.setHeader("Accept-Ranges", "bytes");
        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "video/mp4");
      }
    },
  })
);

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://thinkcode-vol1.vercel.app');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') res.sendStatus(200);
  else next();
});




const gameRoutes = require("./routes/gameRoutes");
app.use("/api/game", gameRoutes);




const videoRoutes = require("./routes/videoRoutes");

app.use("/api/video", videoRoutes);


const PORT = process.env.PORT || 5000;

// Health check
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "ThinkCode Backend is running 🚀"
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ====== START SERVER + SYNC DATABASE ====== //
const startServer = async () => {
  try {
    await models.sequelize.authenticate(); 
    console.log("✅ Database connected");

    await models.sequelize.sync({ alter: false });

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error("❌ Database or sync error:", err);
  }
};

startServer();