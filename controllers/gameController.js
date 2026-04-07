const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Badge = require("../models/Badge");
const UserBadge = require("../models/UserBadge");
// HAPUS: const UserStreak = require("../models/UserStreak");

/* ================= GET GAME MAP ================= */
exports.getGameMap = async (req, res) => {
  try {
    const levels = await GameLevel.findAll({
      order: [["materi_id", "ASC"], ["levelNumber", "ASC"]],
      attributes: ["id", "title", "levelNumber", "materi_id"]
    });

    let progress = [];
    let userStats = { xp: 0, streak: 1, totalLevels: 0, completedLevels: 0 }; // Simple streak

    if (req.user) {
      progress = await UserProgress.findAll({
        where: { userId: req.user.id },
        attributes: ["levelId", "completed", "score"]
      });

      const user = await User.findByPk(req.user.id, { attributes: ["xp"] });
      userStats.xp = user?.xp || 0;
      userStats.totalLevels = levels.length;
      userStats.completedLevels = progress.filter(p => p.completed).length;
    }

    res.json({ status: true, levels, progress, userStats });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET USER PROGRESS ================= */
exports.getProgress = async (req, res) => {
  try {
    const progress = await UserProgress.findAll({
      where: { userId: req.user.id }
    });
    res.json({ status: true, data: progress });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET SINGLE LEVEL ================= */
exports.getLevel = async (req, res) => {
  try {
    const level = await GameLevel.findByPk(req.params.id);
    if (!level) return res.status(404).json({ status: false, message: "Level tidak ditemukan" });

    const questions = await GameQuestion.findAll({
      where: { levelId: level.id },
      order: [["id", "ASC"]],
    });

    const fixedQuestions = questions.map(q => {
      let meta = q.meta;
      if (typeof meta === "string") {
        try { meta = JSON.parse(meta); } catch { meta = {}; }
      }
      return { ...q.dataValues, meta };
    });

    res.json({ status: true, level: level.dataValues, questions: fixedQuestions });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= SUBMIT LEVEL ================= */
exports.submitLevel = async (req, res) => {
  try {
    const userId = req.user.id;
    const levelId = req.params.id;
    const answers = req.body.answers || [];

    const level = await GameLevel.findByPk(levelId);
    if (!level) return res.status(404).json({ status: false });

    let correct = 0;
    const total = answers.length;

    for (const ans of answers) {
      const q = await GameQuestion.findByPk(ans.questionId);
      if (!q) continue;

      let meta = q.meta;
      if (typeof meta === "string") meta = JSON.parse(meta);

      let isCorrect = false;
      switch (q.type) {
        case "mcq": isCorrect = Number(ans.answer) === Number(meta.answerIndex); break;
        case "truefalse": isCorrect = Boolean(ans.answer) === Boolean(meta.isTrue); break;
        case "essay":
        case "typing": 
          isCorrect = String(ans.answer).trim().toLowerCase() === String(meta.answer).trim().toLowerCase(); break;
        case "flashcard": isCorrect = ans.answer === 'correct'; break;
        default: isCorrect = false;
      }

      if (isCorrect) correct++;
    }

    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const gainedXp = scorePercent >= 60 ? (level.reward_xp || 10) : 5;

    await UserProgress.upsert({
      userId, levelId,
      completed: scorePercent >= 60,
      score: scorePercent
    });

    const user = await User.findByPk(userId);
    user.xp = (user.xp || 0) + gainedXp;
    await user.save();

    res.json({
      status: true,
      total, correct, scorePercent, gainedXp,
      totalXp: user.xp,
      streak: 1
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET USER STATS ================= */
exports.getUserStats = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ["xp"] });
    const progress = await UserProgress.findAll({ where: { userId: req.user.id } });
    
    res.json({
      status: true,
      stats: {
        xp: user?.xp || 0,
        streak: 1,
        totalLevels: progress.length,
        completedLevels: progress.filter(p => p.completed).length
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= LEADERBOARD ================= */
exports.getLeaderboard = async (req, res) => {
  try {
    const topUsers = await User.findAll({
      attributes: ["id", "username", "xp"],
      order: [["xp", "DESC"]],
      limit: 10
    });
    res.json({ status: true, leaderboard: topUsers });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};