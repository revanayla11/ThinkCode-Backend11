// routes/adminGameRoutes.js
const express = require("express");
const router = express.Router();
const verifyToken = require("../../middleware/verifyToken");
const isAdmin = require("../../middleware/isAdmin");
const ctrl = require("../../controllers/admin/miniGameAdminController");

router.get("/materi/:materiId/game-levels", verifyToken, isAdmin, ctrl.getMateriGameLevels);
router.get("/game/level/:levelId/questions", verifyToken, isAdmin, ctrl.getLevelQuestions);
router.post("/game/:levelId/question", verifyToken, isAdmin, ctrl.createQuestion);
router.put("/game/question/:id", verifyToken, isAdmin, ctrl.updateQuestion);
router.delete("/game/question/:id", verifyToken, isAdmin, ctrl.deleteQuestion);

module.exports = router;