const express = require("express");
const router = express.Router();
const uploadController = require("../controllers/uploadController");
const verifyToken = require("../middleware/verifyToken");

router.post("/", verifyToken, uploadController.uploadMiddleware, uploadController.uploadAnswer);
router.get("/user/:userId", verifyToken, uploadController.getUploadsByUser);
router.get("/:userId/:materiId", uploadController.getLastUpload);

// BARU: Route untuk check rooms completion
router.get("/:materiId/rooms-completion/:userId", verifyToken, uploadController.checkRoomsCompletion);

module.exports = router;