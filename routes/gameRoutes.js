const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

// ================= PUBLIC ROUTES =================
router.get("/map", gameController.getGameMap);           // Game map + progress + stats
router.get("/level/:id", gameController.getLevel);       // Single level + questions
router.get("/leaderboard", gameController.getLeaderboard); // Public leaderboard

// ================= PROTECTED ROUTES =================
router.get("/progress", verifyToken, gameController.getProgress);     // User progress
router.get("/stats", verifyToken, gameController.getUserStats);       // User stats
router.post("/submit/:id", verifyToken, gameController.submitLevel);  // Submit answers

// ================= ADMIN ROUTES (OPTIONAL) =================
router.post("/admin/levels", verifyToken, gameController.createLevel); // Buat level baru
router.put("/admin/levels/:id", verifyToken, gameController.updateLevel);
router.delete("/admin/levels/:id", verifyToken, gameController.deleteLevel);

module.exports = router;