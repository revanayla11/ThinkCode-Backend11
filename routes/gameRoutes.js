// routes/gameRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

// PUBLIC ROUTES
router.get("/map", gameController.getGameMap);     // ✅ UNTUK GAMEMAP
router.get("/level/:id", gameController.getLevel); // ✅ UNTUK PLAY LEVEL
router.get("/levels", gameController.getLevels);   // ✅ TAMBAH INI

// PROTECTED ROUTES
router.get("/progress", verifyToken, gameController.getProgress);
router.post("/submit/:id", verifyToken, gameController.submitLevel);



module.exports = router;