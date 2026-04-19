require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const dashboardRoutes = require("./routes/dashboardRoutes");
const models = require("./models"); 

const app = express();
const server = http.createServer(app);

// ✅ CORS - FIXED
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://thinkcode-vol1.vercel.app"
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],  
  allowedHeaders: ["Content-Type", "Authorization"]  
}));

app.use(express.json({ limit: '10mb' }));  
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ SEMUA ROUTES SEKALI SAJA - NO DUPLICATION!
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
app.use("/api/video", require("./routes/videoRoutes"));
app.use("/api/feedback", require("./routes/feedback"));

// ✅ ADMIN ROUTES
app.use("/api/admin/users", require("./routes/admin/userAdminRoutes"));
app.use("/api/admin/materi", require("./routes/admin/materiAdminRoutes"));
app.use("/api/admin/submissions", require("./routes/admin/submissionAdminRoutes"));
app.use("/api/admin/discussion", require("./routes/admin/discussionAdminRoutes"));
app.use("/api/admin/achievement", require("./routes/admin/achievementAdminRoutes"));
app.use("/api/admin/leaderboard", require("./routes/admin/leaderboardAdminRoutes"));
app.use("/api/admin/minigame", require("./routes/admin/miniGameAdminRoutes"));
app.use("/api/admin/profile", require("./routes/admin/adminProfileRoutes"));
app.use("/api/admin/badges", require("./routes/admin/badgeAdminRoutes"));
app.use("/api/admin", require("./routes/admin/adminRoutes"));
app.use("/api/admin/students", require("./routes/admin/studentAdminRoutes")); 

// ✅ UPLOADS STATIC - FIXED
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  etag: false,
  lastModified: false,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp4")) {
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "video/mp4");
    }
  }
}));

const PORT = process.env.PORT || 5000;

// ✅ Health check
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "ThinkCode Backend is running 🚀",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// ====== SAFE SYNC FUNCTION ======
const safeSync = async () => {
  try {
    if (process.env.AUTO_SYNC !== 'false') {
      console.log("ℹ️  Sync disabled");
      return true;
    }

    console.log("🔄 SAFE SYNC MODE...");
    
    // 1. DISABLE FOREIGN KEYS
    await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await models.sequelize.query('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO"');
    console.log("🔓 Foreign keys disabled");
    
    // 2. DROP CORRUPT TABLES
    const corruptTables = [
      'user_material_progress', 
      'discussion_rooms', 
      'discussion_room_users'
    ];
    
    for (let table of corruptTables) {
      try {
        await models.sequelize.query(`DROP TABLE IF EXISTS \`${table}\``);
        console.log(`🗑️  Dropped: ${table}`);
      } catch (e) {
        console.log(`⚠️  Skip ${table}`);
      }
    }
    
    // 3. FULL SYNC
    await models.sequelize.sync({ 
      force: true,  // FORCE recreate bersih
      logging: false 
    });
    console.log("✅ Tables recreated!");
    
    // 4. RE-ENABLE
    await models.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
    return true;
    
  } catch (error) {
    console.error("⚠️ Sync failed:", error.message);
    return false;
  }
};

// ====== START SERVER (GANTI INI!) ======
const startServer = async () => {
  try {
    // Test DB
    await models.sequelize.authenticate();
    console.log("✅ Database ready");

    // SAFE SYNC
    const syncOk = await safeSync();
    
    if (!syncOk) {
      console.log("⚠️ Sync failed, but continuing...");
    }

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`📱 Health: http://localhost:${PORT}/health`);
    });

  } catch (error) {
    console.error("💥 Startup failed:", error);
    process.exit(1);
  }
};

startServer();