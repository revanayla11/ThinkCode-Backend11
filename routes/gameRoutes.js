const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

// PUBLIC ROUTES
router.get("/map", gameController.getGameMap);
router.get("/level/:id", gameController.getLevel);
router.get("/leaderboard", gameController.getLeaderboard);

// PROTECTED ROUTES
router.get("/progress", verifyToken, gameController.getProgress);
router.get("/stats", verifyToken, gameController.getUserStats);
router.post("/submit/:id", verifyToken, gameController.submitLevel);

module.exports = router;