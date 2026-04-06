// controllers/gameController.js
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Badge = require("../models/Badge");
const UserBadge = require("../models/UserBadge");
const Materi = require("../models/Materi");
const { Sequelize } = require('sequelize');

/* ================= 1. GAME MAP (BARU) ================= */
exports.getGameMap = async (req, res) => {
  try {
    const levels = await GameLevel.findAll({
      include: [{
        model: Materi, 
        attributes: ['id', 'title']
      }],
      order: [['materi_id', 'ASC'], ['levelNumber', 'ASC']],
      where: { isActive: true }
    });

    const transformedLevels = levels.map(lvl => ({
      id: lvl.id,
      materiId: lvl.materi_id,
      materiName: lvl.Materi.title,
      levelNumber: lvl.levelNumber,
      title: lvl.title,
      type: lvl.type || 'quiz',
      reward_xp: lvl.reward_xp
    }));

    res.json({ status: true, levels: transformedLevels });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= 2. GET LEVELS ================= */
exports.getLevels = async (req, res) => {
  try {
    const levels = await GameLevel.findAll({
      order: [["materi_id", "ASC"], ["levelNumber", "ASC"]],
    });
    res.json({ status: true, data: levels });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= 3. USER PROGRESS ================= */
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

/* ================= 4. GET LEVEL BY ID ================= */
exports.getLevel = async (req, res) => {
  try {
    const level = await GameLevel.findByPk(req.params.id);
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

/* ================= 5. SUBMIT LEVEL (FULL SUPPORT) ================= */
exports.submitLevel = async (req, res) => {
  try {
    const userId = req.user.id;
    const levelId = req.params.id;
    const answers = req.body.answers || [];

    const level = await GameLevel.findByPk(levelId, { include: [{ model: Badge }] });
    if (!level) return res.status(404).json({ status: false });

    let correct = 0, total = 0;

    for (const ans of answers) {
      const q = await GameQuestion.findByPk(ans.questionId);
      if (!q) continue;

      let meta = typeof q.meta === "string" ? JSON.parse(q.meta) : q.meta;
      total++;

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
          if (String(ans.answer).trim().toLowerCase() === String(meta.answer).trim().toLowerCase()) correct++;
          break;
        case "dragdrop":
          if (String(ans.answer).trim() === String(meta.correctZone)) correct++;
          break;
      }
    }

    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const gainedXp = scorePercent >= 70 ? level.reward_xp : Math.floor(level.reward_xp * 0.3);

    // Save progress
    await UserProgress.upsert({
      userId, levelId,
      completed: scorePercent >= 70,
      score: scorePercent,
      attempts: Sequelize.literal('COALESCE(attempts, 0) + 1')
    });

    // Add XP
    await User.increment('xp', { by: gainedXp, where: { id: userId } });
    const user = await User.findByPk(userId, { attributes: ['xp'] });

    // Badge
    let badge = null;
    if (scorePercent === 100 && level.Badge) {
      await UserBadge.findOrCreate({
        where: { user_id: userId, badge_id: level.Badge.id }
      });
      badge = {
        badge_name: level.Badge.badge_name,
        image: `${process.env.BASE_URL}${level.Badge.image}`
      };
    }

    res.json({
      status: true, total, correct, scorePercent, gainedXp,
      totalXpUser: user.xp, badge
    });
  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= 6. ADD XP ================= */
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
    res.status(500).json({ status: false, message: "Gagal menambahkan XP" });
  }
};