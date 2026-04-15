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
router.get("/mini-lesson/:materiId", verifyToken, discussionController.getMiniLesson);

// ================= CLUES =================
router.get("/clues/:materiId", verifyToken, discussionController.getClues);
router.get("/clue/used/:roomId", verifyToken, discussionController.getUsedClues);
router.post("/clue/use/:roomId/:clueId", verifyToken, discussionController.useClue);

// ================= WORKSPACE =================
router.get("/room/:roomId/workspace-data", verifyToken, discussionController.getWorkspaceData);
router.get("/room/:roomId/tasks", verifyToken, discussionController.getTaskProgress);
router.post("/room/:roomId/pseudocode", verifyToken, discussionController.savePseudocode);
router.post("/room/:roomId/flowchart", verifyToken, discussionController.saveFlowchart);
router.post("/room/:roomId/validate", verifyToken, discussionController.validateWorkspace);

// ================= DYNAMIC TEMPLATE =================
router.get("/template-dynamic/:materiId", verifyToken, discussionController.getDynamicTemplate);

// ================= PERFORMANCE & STATUS =================
router.get("/room/:roomId/performance", verifyToken, discussionController.getRoomPerformance);
router.get("/submission/status/:roomId", verifyToken, discussionController.getSubmissionStatus);

// ================= TASKS =================
router.post("/room/:roomId/task/:taskId/toggle", verifyToken, discussionController.toggleTask);

// ================= TIMER =================
router.get("/timer/:roomId/check", verifyToken, discussionController.checkTimerStatus);
router.post("/room/:roomId/timer/start", verifyToken, discussionController.startRoomTimer);

// ================= DEBUG (ADMIN ONLY) =================
router.post('/room/:roomId/debug', auth, verifyToken, discussionController.debugRoom);
router.get('/room/:roomId/debug-validation', auth, verifyToken, discussionController.debugValidation);
router.get('/room/:roomId/workspace-attempts', auth, verifyToken, discussionController.getWorkspaceAttempts);

// routes/discussion.js
router.post('/room/:roomId/submit', verifyToken, discussionController.markRoomSubmitted);

module.exports = router;