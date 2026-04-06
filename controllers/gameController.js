const { Sequelize } = require('sequelize');
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Badge = require("../models/Badge");
const UserBadge = require("../models/UserBadge");
const Materi = require("../models/Materi"); // Tambahkan ini

/* ================= GET GAME MAP (BARU) ================= */
exports.getGameMap = async (req, res) => {
  try {
    const levels = await GameLevel.findAll({
      include: [{
        model: Materi, 
        attributes: ['id', 'title']
      }],
      order: [['materi_id', 'ASC'], ['levelNumber', 'ASC']],
      where: { isActive: true } // Hanya level aktif
    });

    const transformedLevels = levels.map(lvl => ({
      id: lvl.id,
      materiId: lvl.materi_id,
      materiName: lvl.Materi.title,
      levelNumber: lvl.levelNumber,
      title: lvl.title,
      type: lvl.type || 'quiz', // quiz, flashcard, memory, typing, sort
      reward_xp: lvl.reward_xp
    }));

    res.json({ 
      status: true, 
      levels: transformedLevels 
    });
  } catch (err) {
    console.error("GET MAP ERROR:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET USER PROGRESS ================= */
exports.getProgress = async (req, res) => {
  try {
    const progress = await UserProgress.findAll({
      where: { userId: req.user.id },
    });
    res.json({ status: true, data: progress });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET LEVEL BY ID ================= */
exports.getLevel = async (req, res) => {
  try {
    const level = await GameLevel.findByPk(req.params.id, {
      include: [{ model: Materi, attributes: ['title'] }]
    });
    
    if (!level) {
      return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
    }

    const questions = await GameQuestion.findAll({
      where: { levelId: level.id },
      order: [["id", "ASC"]],
    });

    res.json({ status: true, level, questions });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= SUBMIT LEVEL (UPDATED - Support semua game types) ================= */
exports.submitLevel = async (req, res) => {
  try {
    const userId = req.user.id;
    const levelId = req.params.id;
    const answers = req.body.answers || [];

    const level = await GameLevel.findByPk(levelId, {
      include: [{ model: Badge }], 
    });

    if (!level) {
      return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
    }

    let correct = 0;
    let total = 0;

    for (const ans of answers) {
      const q = await GameQuestion.findByPk(ans.questionId);
      if (!q) continue;

      let meta = q.meta;
      if (typeof meta === "string") meta = JSON.parse(meta);

      total++;

      // Support semua game types
      switch (q.type) {
        case "mcq":
          if (Number(ans.answer) === Number(meta.answerIndex)) correct++;
          break;
          
        case "truefalse":
          if (Boolean(ans.answer) === Boolean(meta.isTrue)) correct++;
          break;
          
        case "essay":
        case "typing":
        case "fill":
          if (
            String(ans.answer).trim().toLowerCase() ===
            String(meta.answer).trim().toLowerCase()
          ) {
            correct++;
          }
          break;
          
        case "dragdrop":
          if (String(ans.answer).trim() === String(meta.correctZone)) correct++;
          break;
          
        case "sort":
          if (Array.isArray(ans.answer) && 
              JSON.stringify(ans.answer.sort()) === JSON.stringify(meta.correctOrder.sort())) {
            correct++;
          }
          break;
      }
    }

    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passThreshold = 70; // Naikkan passing grade
    const gainedXp = scorePercent >= passThreshold ? level.reward_xp : Math.floor(level.reward_xp * 0.3);

    // ===== SIMPAN PROGRESS =====
    await UserProgress.upsert({
      userId,
      levelId,
      completed: scorePercent >= passThreshold,
      score: scorePercent,
      attempts: Sequelize.literal('COALESCE(attempts, 0) + 1')
    });

    // ===== TAMBAH XP =====
    await User.increment('xp', { 
      by: gainedXp, 
      where: { id: userId } 
    });

    const user = await User.findByPk(userId, { attributes: ['xp'] });
    
    // ===== BADGE (perfect score atau first time) =====
    let badge = null;
    if ((scorePercent === 100 || scorePercent >= 90) && level.Badge) {
      const [userBadge, created] = await UserBadge.findOrCreate({
        where: { user_id: userId, badge_id: level.Badge.id },
      });

      if (created) {
        badge = {
          badge_name: level.Badge.badge_name,
          image: `${process.env.BASE_URL}${level.Badge.image}`,
        };
      }
    }

    // Streak bonus untuk skor tinggi
    const streakBonus = scorePercent >= 90 ? 50 : 0;

    res.json({
      status: true,
      total,
      correct,
      scorePercent,
      gainedXp,
      streakBonus,
      totalXpUser: user.xp,
      badge,
      message: scorePercent >= passThreshold ? "Level selesai!" : "Coba lagi untuk skor lebih baik!"
    });
  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= ADD XP (ADMIN ONLY) ================= */
exports.addXp = async (req, res) => {
  try {
    const userId = req.user.id;
    const { xp } = req.body;

    if (!xp || Number(xp) <= 0) {
      return res.status(400).json({ status: false, message: "XP tidak valid" });
    }

    await User.increment('xp', { by: Number(xp), where: { id: userId } });
    const updatedUser = await User.findByPk(userId, { attributes: ["id", "xp"] });

    res.json({
      status: true,
      message: "XP berhasil ditambahkan",
      xp: updatedUser.xp
    });
  } catch (err) {
    console.error("ADD XP ERROR:", err);
    res.status(500).json({ status: false, message: "Gagal menambahkan XP" });
  }
};