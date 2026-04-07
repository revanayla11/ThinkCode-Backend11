const multer = require("multer");
const path = require("path");
const Submission = require("../models/Submission");
const Badge = require("../models/Badge");
const User = require("../models/User");
const Materi = require("../models/Materi");

const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, "..", "uploads")),
  filename: (req, file, cb) =>
    cb(null, Date.now() + "_" + file.originalname)
});

const uploadMiddleware = multer({ storage });
exports.uploadMiddleware = uploadMiddleware.single("file");

// Upload jawaban (NO CHANGES)
exports.uploadAnswer = async (req, res) => {
  try {
    const userId = req.user.id;
    const { materiId, note } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;

    const submission = await Submission.create({
      userId,
      materiId,
      note,
      filePath
    });

    res.json({ status: true, data: submission });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// Get uploads by user (NO CHANGES)
exports.getUploadsByUser = async (req, res) => {
  try {
    const userId = req.params.userId;

    const list = await Submission.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]]
    });

    res.json({ status: true, data: list });

  } catch (err) {
    console.error("GET UPLOADS ERROR:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// Get last upload (NO CHANGES)
exports.getLastUpload = async (req, res) => {
  try {
    const { userId, materiId } = req.params;

    const last = await Submission.findOne({
      where: { userId, materiId },
      include: [
        { model: require("../models/User"), as: "User" }, 
        { model: require("../models/Materi"), as: "Materi" }, 
        { model: Badge, as: "Badge" }
      ],
      order: [["createdAt", "DESC"]]
    });

    res.json({ status: true, data: last });

  } catch (err) {
    console.error("LAST UPLOAD ERROR:", err);
    res.status(500).json({ status: false });
  }
};

// BARU: Check rooms completion & random picker
exports.checkRoomsCompletion = async (req, res) => {
  try {
    const { materiId, userId } = req.params;
    
    // Ambil materi
    const materi = await Materi.findByPk(materiId);
    
    if (!materi) {
      return res.json({ allCompleted: false, randomPresenter: null });
    }

    // Cek submissions user untuk materi ini
    const userSubmissions = await Submission.findAll({
      where: { userId, materiId },
      include: [{ model: User, as: "User" }]
    });

    // Jika ada submission, berarti sudah selesai untuk materi ini
    const allCompleted = userSubmissions.length > 0;

    let randomPresenter = null;
    
    if (allCompleted) {
      // Random picker: ambil top submissions untuk materi ini
      const topSubmissions = await Submission.findAll({
        where: { materiId },
        include: [
          { model: User, as: "User" }
        ],
        order: [
          ['score', 'DESC'], 
          ['createdAt', 'DESC']
        ],
        limit: 20 // Ambil 20 teratas untuk random pick
      });

      if (topSubmissions.length > 0) {
        // Pilih random dari top 20
        const randomIndex = Math.floor(Math.random() * topSubmissions.length);
        const selected = topSubmissions[randomIndex];
        
        randomPresenter = {
          name: selected.User?.name || `User ${selected.userId}`,
          roomName: selected.roomName || `Room ${selected.id.slice(-4)}`,
          score: selected.score || 0,
          userId: selected.userId
        };
      }
    }

    res.json({ 
      allCompleted, 
      randomPresenter,
      totalSubmissions: userSubmissions.length,
      userSubmissions: userSubmissions.map(s => ({
        id: s.id,
        score: s.score,
        createdAt: s.createdAt
      }))
    });

  } catch (err) {
    console.error("ROOMS COMPLETION ERROR:", err);
    res.status(500).json({ allCompleted: false, randomPresenter: null });
  }
};