const router = require("express").Router();
const verifyToken = require("../../middleware/verifyToken");
const isAdmin = require("../../middleware/isAdmin");
const ctrl = require("../../controllers/admin/discussionAdminController");
console.log("DEBUG CONTROLLER:", ctrl);

// Route untuk list materi
router.get("/materi", verifyToken, isAdmin, ctrl.listMateri);

router.get("/rooms/by-materi/:materiId", verifyToken, isAdmin, ctrl.listRoomsByMateri);
router.get("/room/:roomId", verifyToken, isAdmin, ctrl.roomDetail);
router.get("/room/:roomId/members", verifyToken, isAdmin, ctrl.roomMembers);
router.get("/room/:roomId/clues", verifyToken, isAdmin, ctrl.roomClues);
router.put("/rooms/:id/toggle", verifyToken, isAdmin, ctrl.toggleRoom);
router.post("/rooms", verifyToken, isAdmin, ctrl.createRoom);
router.put("/rooms/:id", verifyToken, isAdmin, ctrl.updateRoom);
router.delete("/rooms/:id", verifyToken, isAdmin, ctrl.deleteRoom);

router.get("/workspace/attempts/:roomId", verifyToken, isAdmin, ctrl.workspaceAttempts);
router.get("/workspace/latest/:roomId", verifyToken, isAdmin, ctrl.workspaceLatest);

router.get("/admin/materi/answer/:roomId", adminController.getMateriAnswer);
router.post("/materi/answer", verifyToken, isAdmin, ctrl.saveMateriAnswer);

module.exports = router;