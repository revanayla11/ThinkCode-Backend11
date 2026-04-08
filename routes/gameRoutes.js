// routes/game.js - FIXED
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

// PUBLIC
router.get("/map", gameController.getGameMap);
router.get("/level/:id", gameController.getLevel);

// 🔥 FIXED: sesuain sama frontend
router.post("/submit/:id", verifyToken, gameController.submitLevel);  // ← UDAH BENAR
router.get("/stats", verifyToken, gameController.getUserStats);

module.exports = router;