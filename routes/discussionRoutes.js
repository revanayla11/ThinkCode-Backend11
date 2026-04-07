const express = require("express");
const router = express.Router();
const discussionController = require("../controllers/discussionController");
const verifyToken = require("../middleware/verifyToken");
const auth = require("../middleware/auth");

// ================= ROOM =================
router.get("/rooms/:materiId", verifyToken, discussionController.getRooms);
router.get("/room/:roomId", verifyToken, discussionController.getRoom);
router.post("/room/:roomId/join", verifyToken, discussionController.joinRoom);
router.post("/room/:roomId/send", verifyToken, discussionController.sendMessage);

// ================= MINI LESSON =================
router.get("/mini-lesson/:materiId", verifyToken, discussionController.getMiniLesson); // ✅ FIXED

// ================= CLUES =================
router.get("/clues/:materiId", verifyToken, discussionController.getClues);           // ✅ FIXED
router.get("/clue/used/:roomId", verifyToken, discussionController.getUsedClues);    // ✅ FIXED
router.post("/clue/use/:roomId/:clueId", verifyToken, discussionController.useClue); // ✅ FIXED

// ================= WORKSPACE ================= ✅ TAMBAH INI
router.get("/room/:roomId/workspace-data", verifyToken, discussionController.getWorkspaceData);
router.get("/room/:roomId/tasks", verifyToken, discussionController.getTaskProgress);
router.post("/room/:roomId/pseudocode", verifyToken, discussionController.savePseudocode);
router.post("/room/:roomId/flowchart", verifyToken, discussionController.saveFlowchart);
router.post("/room/:roomId/validate", verifyToken, discussionController.validateWorkspace);

// ================= TEMPLATE ================= ✅ TAMBAH INI
router.get("/template/:roomId", verifyToken, discussionController.getPseudocodeTemplate);

// ================= TIMER ================= ✅ TAMBAH INI
router.get("/timer/:roomId/check", verifyToken, discussionController.checkTimerStatus);
router.post("/room/:roomId/timer/start", verifyToken, discussionController.startRoomTimer);

// ================= PERFORMANCE & STATUS ================= ✅ SUDAH ADA
router.get("/room/:roomId/performance", verifyToken, discussionController.getRoomPerformance);
router.get("/submission/status/:roomId", verifyToken, discussionController.getSubmissionStatus);

// ================= TASKS (OLD ROUTES - HAPUS ATAU REDIRECT) =================
router.get("/task/:roomId", verifyToken, discussionController.getTaskProgress);
router.put("/task/:roomId/:taskId", verifyToken, discussionController.updateTask);

// ================= UPLOAD CHECK =================
router.get("/upload/:roomId/check", verifyToken, discussionController.checkAllTasksDone);

// routes/discussion.js - TAMBAHKAN INI
router.post("/room/:roomId/task/:taskId/toggle", verifyToken, discussionController.toggleTask); // ✅ NEW

module.exports = router;

