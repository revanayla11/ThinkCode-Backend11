const express = require("express");
const router = express.Router();
const controller = require("../../controllers/admin/miniGameAdminController");

// ==================== MATERI ====================
router.get("/materi", controller.getMateri);

// ==================== BADGE ====================
router.get("/badges", controller.getBadges);

// ==================== LEVEL ====================
router.get("/:slug/levels", controller.getLevelsByMateri);
router.post("/:slug/levels", controller.addLevel);
router.get("/:slug/levels/:levelNumber", controller.getLevelWithQuestions);
router.delete("/level/:levelId", controller.deleteLevel);
router.put("/level/:levelId", controller.updateLevel);

// ==================== QUESTION ====================
router.post("/:slug/levels/:levelNumber/question", controller.addQuestionBySlugLevel);
router.delete("/question/:questionId", controller.deleteQuestion);
router.put("/question/:id", controller.updateQuestion); 

module.exports = router;
