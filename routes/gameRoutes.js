// routes/game.js - FIXED
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

// PUBLIC
router.get("/map", verifyToken, gameController.getGameMap);
router.get("/level/:id",verifyToken, gameController.getLevel);

// 🔥 FIXED: sesuain sama frontend
router.post('/level/:id/submit', verifyToken, gameController.submitLevel);  // ← UDAH BENAR
router.get("/stats", verifyToken, gameController.getUserStats);

module.exports = router;