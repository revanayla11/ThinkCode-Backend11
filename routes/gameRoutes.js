// routes/gameRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

// ✅ PASTIKAN EXPORT SESUAI ROUTE
router.get("/map", gameController.getGameMap);           // ✅ Baru
router.get("/levels", gameController.getLevels);
router.get("/level/:id", gameController.getLevel);
router.get("/progress", verifyToken, gameController.getProgress);
router.post("/submit/:id", verifyToken, gameController.submitLevel);
router.post("/xp", verifyToken, gameController.addXp);

module.exports = router;