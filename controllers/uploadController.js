const { Op } = require('sequelize');
const multer = require("multer");
const path = require("path");
const Submission = require("../models/Submission");
const Badge = require("../models/Badge");
const User = require("../models/User");
const Materi = require("../models/Materi");
const UserMateriProgress = require("../models/UserMateriProgress");
const DiscussionRoom = require("../models/DiscussionRoom");
const User = require("../models/User");

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

exports.checkRoomsCompletion = async (req, res) => {
  try {
    const { materiId, userId } = req.params;
    
    // 1. Ambil SEMUA rooms materi ini
    const allRooms = await DiscussionRoom.findAll({
      where: { materiId: parseInt(materiId) },
      attributes: ['id', 'title']
    });
    
    if (allRooms.length === 0) {
      return res.json({ allCompleted: false, randomPresenter: null });
    }
    
    // 2. Cek user sudah submit?
    const userSubmission = await Submission.findOne({
      where: { userId: parseInt(userId), materiId: parseInt(materiId) }
    });
    const userCompleted = !!userSubmission;
    
    // 3. Cek tiap room sudah ada submission?
    let allRoomsSubmitted = true;
    const roomStatuses = [];
    
    for (const room of allRooms) {
      // Ambil members room ini
      const roomMembers = await UserMateriProgress.findAll({
        where: { 
          roomId: room.id, 
          materiId: parseInt(materiId) 
        },
        attributes: ['userId']
      });
      
      const memberUserIds = roomMembers.map(m => m.userId);
      
      // Cek ada submission dari member room ini?
      const roomSubmissionCount = await Submission.count({
        where: { 
          materiId: parseInt(materiId),
          userId: { [Op.in]: memberUserIds }
        }
      });
      
      const roomSubmitted = roomSubmissionCount > 0;
      roomStatuses.push({
        roomId: room.id,
        roomName: room.title,
        submitted: roomSubmitted,
        memberCount: memberUserIds.length
      });
      
      if (!roomSubmitted) allRoomsSubmitted = false;
    }
    
    // 4. Random presenter (semua room selesai)
    let randomPresenter = null;
    if (allRoomsSubmitted) {
      // Ambil submissions terbaik
      const topSubmissions = await Submission.findAll({
        where: { materiId: parseInt(materiId) },
        include: [{
          model: User,
          attributes: ['id', 'name']
        }],
        order: [['score', 'DESC'], ['createdAt', 'DESC']],
        limit: 20
      });
      
      if (topSubmissions.length > 0) {
        const randomIndex = Math.floor(Math.random() * topSubmissions.length);
        const selected = topSubmissions[randomIndex];
        
        // Cari room name berdasarkan user
        const userRoom = await UserMateriProgress.findOne({
          where: { userId: selected.userId, materiId: parseInt(materiId) }
        });
        
        const room = userRoom ? 
          await DiscussionRoom.findByPk(userRoom.roomId, { attributes: ['title'] }) : 
          null;
        
        randomPresenter = {
          name: selected.User?.name || `User ${selected.userId}`,
          roomName: room?.title || `Room ${selected.id?.toString().slice(-3)}`,
          score: selected.score || 0,
          userId: selected.userId
        };
      }
    }
    
    res.json({
      allCompleted: allRoomsSubmitted,
      userCompleted,
      randomPresenter,
      totalRooms: allRooms.length,
      roomStatuses
    });
    
  } catch (err) {
    console.error("ROOMS ERROR:", err);
    res.json({ allCompleted: false, randomPresenter: null });
  }
};