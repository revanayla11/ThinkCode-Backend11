// routes/gameRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

// Public routes
router.get("/map", gameController.getGameMap);
router.get("/level/:id", gameController.getLevel);

// Protected routes
router.get("/progress", verifyToken, gameController.getProgress);
router.post("/submit/:id", verifyToken, gameController.submitLevel);

module.exports = router;