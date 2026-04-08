// routes/game.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

// PUBLIC - Siapa saja bisa main map
router.get("/map", gameController.getGameMap);
router.get("/level/:id", gameController.getLevel);

// PROTECTED - Butuh login buat submit
router.post("/submit/:id", verifyToken, gameController.submitLevel);
router.get("/stats", verifyToken, gameController.getUserStats);


module.exports = router;