const express = require("express");
const router = express.Router();
const verifyToken = require("../../middleware/verifyToken");
const isAdmin = require("../../middleware/isAdmin");
const ctrl = require('../../controllers/admin/miniGameAdminController');

// ================= MATERI =================
router.get("/materi", verifyToken, isAdmin, ctrl.getMateri);

// ================= LEVEL =================
router.get("/:slug/levels", verifyToken, isAdmin, ctrl.getLevelsByMateri);
router.post("/:slug/levels", verifyToken, isAdmin, ctrl.addLevel);

// ================= QUESTION =================
router.get("/:slug/levels/:levelNumber", verifyToken, isAdmin, ctrl.getLevelWithQuestions);
router.post("/:slug/levels/:levelNumber/question", verifyToken, isAdmin, ctrl.addQuestionBySlugLevel);

// ================= EXTRA (OPTIONAL) =================
router.put("/level/:levelId", verifyToken, isAdmin, ctrl.updateLevel);
router.delete("/level/:levelId", verifyToken, isAdmin, ctrl.deleteLevel);

router.put("/question/:id", verifyToken, isAdmin, ctrl.updateQuestion);
router.delete("/question/:questionId", verifyToken, isAdmin, ctrl.deleteQuestion);

// ================= BADGE =================
router.get("/badges", verifyToken, isAdmin, ctrl.getBadges);

module.exports = router;