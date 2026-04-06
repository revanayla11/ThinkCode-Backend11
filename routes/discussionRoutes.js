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

// ================= TAMBAH INI DI AKHIR SEBELUM module.exports =================

// 1. TIMER (Mock - bisa diganti real nanti)
router.get("/timer/:roomId/check", verifyToken, (req, res) => {
  res.json({ 
    timeLeft: 3600, 
    penaltyXP: 0, 
    overtimeMinutes: 0 
  });
});

router.post("/room/:roomId/timer/start", verifyToken, (req, res) => {
  res.json({ success: true });
});

// 2. TEMPLATE (Pakai mini lesson)
router.get("/template/:roomId", verifyToken, async (req, res) => {
  try {
    const miniRes = await discussionController.getMiniLesson(req, res, req.params.roomId);
    res.json({
      data: {
        template: miniRes.pseudocode || "IF (___BLANK_0___) THEN ___BLANK_1___ ENDIF",
        blanks: [
          { hint: "condition seperti x > 0" },
          { hint: "print 'Positif'" },
          { hint: "print 'Negatif'" }
        ],
        materiType: "IF-ELSE"
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Template not found" });
  }
});

// 3. CLUES (Gabung getClues + getUsedClues)
router.get("/room/:roomId/clues", verifyToken, async (req, res) => {
  try {
    const allClues = await discussionController.getClues(req, res, req.params.roomId);
    const usedClues = await discussionController.getUsedClues(req, res, req.params.roomId);
    res.json({
      clues: allClues,
      used: usedClues
    });
  } catch (err) {
    res.status(500).json({ error: "Clues error" });
  }
});

module.exports = router;