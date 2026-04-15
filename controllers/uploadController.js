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
    
    // 1. Ambil SEMUA rooms untuk materi ini
    const allRooms = await DiscussionRoom.findAll({
      where: { materiId },
      attributes: ['id', 'title']
    });
    
    if (allRooms.length === 0) {
      return res.json({ 
        allCompleted: false, 
        randomPresenter: null,
        totalRooms: 0 
      });
    }
    
    // 2. Cek submission user
    const userSubmission = await Submission.findOne({
      where: { userId, materiId }
    });
    const userCompleted = !!userSubmission;
    
    // 3. Cek SEMUA rooms sudah submit?
    let allRoomsSubmitted = true;
    const submittedRooms = [];
    
    for (const room of allRooms) {
      const roomSubmission = await Submission.findOne({
        where: { 
          materiId, 
          roomId: room.id 
        }
      });
      
      if (roomSubmission) {
        submittedRooms.push({
          roomId: room.id,
          roomName: room.title,
          submitted: true
        });
      } else {
        allRoomsSubmitted = false;
        submittedRooms.push({
          roomId: room.id,
          roomName: room.title,
          submitted: false
        });
      }
    }
    
    let randomPresenter = null;
    
    // 4. KALAU SEMUA ROOM UDAH SUBMIT → Random picker
    if (allRoomsSubmitted) {
      const roomSubmissions = await Submission.findAll({
        where: { materiId },
        include: [{
          model: User, 
          as: "User",
          attributes: ['id', 'name']
        }, {
          model: DiscussionRoom,
          attributes: ['title']
        }],
        order: [['score', 'DESC'], ['createdAt', 'DESC']]
      });
      
      if (roomSubmissions.length > 0) {
        const randomIndex = Math.floor(Math.random() * roomSubmissions.length);
        const selected = roomSubmissions[randomIndex];
        
        randomPresenter = {
          name: selected.User?.name || `User ${selected.userId}`,
          roomName: selected.DiscussionRoom?.title || `Room ${selected.roomId}`,
          score: selected.score || 0,
          roomId: selected.roomId
        };
      }
    }
    
    res.json({ 
      allCompleted: allRoomsSubmitted,
      userCompleted,
      randomPresenter,
      totalRooms: allRooms.length,
      submittedRoomsCount: submittedRooms.length,
      roomsStatus: submittedRooms
    });

  } catch (err) {
    console.error("ROOMS COMPLETION ERROR:", err);
    res.json({ 
      allCompleted: false, 
      userCompleted: false,
      randomPresenter: null,
      totalRooms: 0 
    });
  }
};