const express = require("express");
const router = express.Router();
const verifyToken = require("../../middleware/verifyToken");
const isAdmin = require("../../middleware/isAdmin");
const ctrl = require("../controllers/admin/miniGameAdminController");

router.get("/materi", verifyToken, isAdmin, ctrl.getMateri);

router.get("/:slug/levels", verifyToken, isAdmin, ctrl.getLevels);
router.post("/:slug/levels", verifyToken, isAdmin, ctrl.addLevel);

router.get("/:slug/levels/:levelNumber", verifyToken, isAdmin, ctrl.getQuestions);
router.post("/:slug/levels/:levelNumber/question", verifyToken, isAdmin, ctrl.addQuestion);

module.exports = router;