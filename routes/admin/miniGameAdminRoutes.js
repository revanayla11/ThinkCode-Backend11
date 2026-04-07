// routes/adminGameRoutes.js
const express = require("express");
const router = express.Router();
const verifyAdmin = require("../middleware/verifyAdmin");
const adminGameController = require("../controllers/adminGameController");

router.get("/materi/:materiId/game-levels", verifyAdmin, adminGameController.getMateriGameLevels);
router.get("/game/level/:levelId/questions", verifyAdmin, adminGameController.getLevelQuestions);
router.post("/game/:levelId/question", verifyAdmin, adminGameController.createQuestion);
router.put("/game/question/:id", verifyAdmin, adminGameController.updateQuestion);
router.delete("/game/question/:id", verifyAdmin, adminGameController.deleteQuestion);

module.exports = router;