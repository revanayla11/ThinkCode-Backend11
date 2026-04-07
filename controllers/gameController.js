const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Badge = require("../models/Badge");
const UserBadge = require("../models/UserBadge");

// HAPUS KOMENTAR INI & IMPORT MODEL STREAK
const UserStreak = require("../models/UserStreak"); // ← BUKA KOMENTAR!

/* ================= GET GAME MAP (Dengan Hearts & Real Streak) ================= */
exports.getGameMap = async (req, res) => {
  try {
    const levels = await GameLevel.findAll({
      order: [["materi_id", "ASC"], ["levelNumber", "ASC"]],
      attributes: ["id", "title", "levelNumber", "materi_id", "reward_xp"]
    });

    let progress = [];
    let userStats = { xp: 0, streak: 0, hearts: 5, totalLevels: 0, completedLevels: 0 };

    if (req.user) {
      // GET PROGRESS
      progress = await UserProgress.findAll({
        where: { userId: req.user.id },
        attributes: ["levelId", "completed", "score"]
      });

      // GET USER STATS + HEARTS + STREAK
      const user = await User.findByPk(req.user.id, { 
        attributes: ["xp", "hearts"] 
      });
      
      // Real streak calculation
      const today = new Date().toISOString().split('T')[0];
      const streakData = await UserStreak.findOne({
        where: { userId: req.user.id, date: today }
      });
      
      userStats = {
        xp: user?.xp || 0,
        hearts: user?.hearts || 5,
        streak: streakData ? streakData.streak : 0,
        totalLevels: levels.length,
        completedLevels: progress.filter(p => p.completed).length
      };
    }

    res.json({ status: true, levels, progress, userStats });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET SINGLE LEVEL (Sama) ================= */
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

/* ================= SUBMIT LEVEL (Tambah Hearts & Streak Logic) ================= */
exports.submitLevel = async (req, res) => {
  try {
    const userId = req.user.id;
    const levelId = req.params.id;
    const answers = req.body.answers || [];

    const level = await GameLevel.findByPk(levelId);
    if (!level) return res.status(404).json({ status: false });

    let correct = 0;
    const total = answers.length;

    // Hitung score
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
    const gainedXp = Math.max(10, Math.round((scorePercent / 100) * (level.reward_xp || 50)));

    // Update progress
    await UserProgress.upsert({
      userId, levelId,
      completed: scorePercent >= 60,
      score: scorePercent
    });

    // Update XP & Hearts
    const user = await User.findByPk(userId);
    user.xp = (user.xp || 0) + gainedXp;
    
    // Hearts logic: kurangi 1 heart per level (max 5)
    if (user.hearts === undefined || user.hearts > 5) user.hearts = 5;
    if (user.hearts > 0) user.hearts -= 1; // 1 heart per level attempt
    
    await user.save();

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let streakData = await UserStreak.findOne({ where: { userId, date: today } });
    if (!streakData) {
      const yesterdayStreak = await UserStreak.findOne({ where: { userId, date: yesterday } });
      const newStreak = yesterdayStreak ? yesterdayStreak.streak + 1 : 1;
      
      await UserStreak.create({ userId, date: today, streak: newStreak });
    }

    // Badge logic (simple)
    let badge = null;
    if (scorePercent >= 90) {
      badge = await Badge.findOne({ where: { name: 'Perfect Sheriff' } });
      if (badge && !(await UserBadge.findOne({ where: { userId, badgeId: badge.id } }))) {
        await UserBadge.create({ userId, badgeId: badge.id });
      }
    }

    res.json({
      status: true,
      total, correct, scorePercent, gainedXp,
      totalXp: user.xp,
      hearts: user.hearts,
      streak: streakData ? streakData.streak : 1,
      badge: badge ? { 
        badge_name: badge.name, 
        image: badge.image || '/badges/perfect-sheriff.png' 
      } : null
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET USER STATS (Lengkap) ================= */
exports.getUserStats = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, { attributes: ["xp", "hearts"] });
    const progress = await UserProgress.findAll({ where: { userId: req.user.id } });
    
    // Get current streak
    const today = new Date().toISOString().split('T')[0];
    const streakData = await UserStreak.findOne({
      where: { userId: req.user.id, date: today }
    });
    
    res.json({
      status: true,
      stats: {
        xp: user?.xp || 0,
        hearts: user?.hearts || 5,
        streak: streakData ? streakData.streak : 0,
        totalLevels: progress.length,
        completedLevels: progress.filter(p => p.completed).length
      }
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};
