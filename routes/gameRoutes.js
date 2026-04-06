const express = require("express");
const router = express.Router();
const verifyToken = require("../middleware/verifyToken");
const gameController = require("../controllers/gameController");

router.get("/map", gameController.getGameMap); // BARU - untuk game map
router.get("/levels", gameController.getLevels);
router.get("/progress", verifyToken, gameController.getProgress);
router.get("/level/:id", gameController.getLevel);
router.post("/submit/:id", verifyToken, gameController.submitLevel);
router.post("/xp", verifyToken, gameController.addXp);

module.exports = router;