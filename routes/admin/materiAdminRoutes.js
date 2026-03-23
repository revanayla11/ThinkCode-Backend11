const router = require("express").Router();
const verifyToken = require("../../middleware/verifyToken");
const isAdmin = require("../../middleware/isAdmin");
const ctrl = require("../../controllers/admin/materiAdminController");

const multer = require("multer");

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/orientasi");
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type'), false);
  }
};

const upload = multer({ 
  storage, 
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }  
});


// Materi CRUD
router.get("/", verifyToken, isAdmin, ctrl.listMateri);
router.post("/", verifyToken, isAdmin, ctrl.createMateri);
router.get("/:id", verifyToken, isAdmin, ctrl.getMateri);
router.put("/:id", verifyToken, isAdmin, ctrl.updateMateri);
router.delete("/:id", verifyToken, isAdmin, ctrl.deleteMateri);

// === ROOMS / DISKUSI ===
router.get("/:id/rooms", verifyToken, isAdmin, ctrl.listRooms);
router.post("/:id/rooms", verifyToken, isAdmin, ctrl.createRoom);
router.put("/:id/rooms/:roomId", verifyToken, isAdmin, ctrl.updateRoom);
router.delete("/:id/rooms/:roomId", verifyToken, isAdmin, ctrl.deleteRoom);

// === SECTIONS / MINI LESSON ===
router.get("/:id/sections", verifyToken, isAdmin, ctrl.listSections);
router.post("/:id/sections", verifyToken, isAdmin, ctrl.createSection);
router.put("/:id/sections/:sectionId", verifyToken, isAdmin, ctrl.updateSection);
router.delete("/:id/sections/:sectionId", verifyToken, isAdmin, ctrl.deleteSection);
router.post(
  "/:id/sections/upload",
  verifyToken,
  isAdmin,
  upload.single("file"),
  ctrl.uploadSectionImage
);


// === CLUES ===
router.get("/:id/clues", verifyToken, isAdmin, ctrl.listClues);
router.post("/:id/clues", verifyToken, isAdmin, ctrl.createClue);
router.put("/:id/clues/:clueId", verifyToken, isAdmin, ctrl.updateClue);
router.delete("/:id/clues/:clueId", verifyToken, isAdmin, ctrl.deleteClue);

// === ORIENTASI MASALAH ===
router.get("/:id/orientasi", verifyToken, isAdmin, ctrl.getOrientasi);
router.put("/:id/orientasi", verifyToken, isAdmin, ctrl.putOrientasi);
router.post("/:id/orientasi/upload", verifyToken, isAdmin, upload.single("file"), ctrl.uploadOrientasi);
router.delete("/:id/orientasi", verifyToken, isAdmin, ctrl.deleteOrientasi);

// === ANSWER / JAWABAN MATERI ===
router.get("/:id/answer", verifyToken, isAdmin, ctrl.getMateriAnswerById);
router.post("/:id/answer", verifyToken, isAdmin, ctrl.saveMateriAnswer);


module.exports = router;
