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
router.get("/mini/:materiId", verifyToken, discussionController.getMiniLesson);

// ================= CLUE =================
router.get("/clue/:materiId", verifyToken, discussionController.getClues);
router.post("/clue/use/:roomId/:clueId", verifyToken, discussionController.useClue);
router.get("/clue/used/:roomId", verifyToken, discussionController.getUsedClues);
router.post(
  "/room/:roomId/clue/:clueId/use", auth,
  discussionController.useClue
);

// ================= WORKSPACE =================
router.post("/workspace/pseudocode/:roomId/save", verifyToken, discussionController.savePseudocode);
router.post("/workspace/flowchart/:roomId/save", verifyToken, discussionController.saveFlowchart);
router.get("/workspace/:roomId", verifyToken, discussionController.getWorkspace);
router.post("/workspace/:roomId/validate", verifyToken, discussionController.validateWorkspace);

// ================= TASK =================
router.get("/task/:roomId", verifyToken, discussionController.getTaskProgress);
router.put("/task/:roomId/:taskId", verifyToken, discussionController.updateTask);
router.get("/upload/:roomId/check", verifyToken, discussionController.checkAllTasksDone); // Untuk cek sebelum upload

router.get(
  "/room/:roomId/performance",
  verifyToken,
  discussionController.getRoomPerformance
);

router.get(
  "/submission/status/:roomId",
  verifyToken,
  discussionController.getSubmissionStatus
);

// Tambahkan untuk XP (jika belum ada)
router.get("/user-xp/:materiId", verifyToken, discussionController.getUserXp);

module.exports = router;