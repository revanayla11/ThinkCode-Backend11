const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Badge = require("../models/Badge");
const UserBadge = require("../models/UserBadge");
const UserStreak = require("../models/UserStreak"); // Tambah model ini

/* ================= GET GAME MAP (LEVELS + PROGRESS + STATS) ================= */
exports.getGameMap = async (req, res) => {
  try {
    const levels = await GameLevel.findAll({
      order: [["materi_id", "ASC"], ["levelNumber", "ASC"]],
      attributes: {
        include: ["id", "title", "levelNumber", "materiId", "materiName"]
      }
    });

    let progress = [];
    let userStats = { xp: 0, streak: 0, totalLevels: 0, completedLevels: 0 };

    if (req.user) {
      // Progress
      progress = await UserProgress.findAll({
        where: { userId: req.user.id },
        attributes: ["levelId", "completed", "score"]
      });

      // User stats
      const user = await User.findByPk(req.user.id, {
        attributes: ["xp"]
      });
      userStats.xp = user?.xp || 0;

      // Streak calculation
      const today = new Date().toISOString().split('T')[0];
      const userStreak = await UserStreak.findOne({ where: { userId: req.user.id } });
      
      if (userStreak) {
        const lastCompleted = new Date(userStreak.lastCompleted);
        const todayDate = new Date(today);
        
        if (lastCompleted.toISOString().split('T')[0] === today) {
          userStats.streak = userStreak.streakCount;
        } else if (lastCompleted.getTime() === todayDate.getTime() - 86400000) {
          userStats.streak = userStreak.streakCount + 1;
          userStreak.streakCount += 1;
          userStreak.lastCompleted = today;
          await userStreak.save();
        } else {
          userStreak.streakCount = 1;
          userStreak.lastCompleted = today;
          await userStreak.save();
          userStats.streak = 1;
        }
      } else {
        await UserStreak.create({ userId: req.user.id, streakCount: 1, lastCompleted: today });
        userStats.streak = 1;
      }

      // Total & completed levels
      userStats.totalLevels = levels.length;
      userStats.completedLevels = progress.filter(p => p.completed).length;
    }

    res.json({ 
      status: true, 
      levels, 
      progress,
      userStats 
    });
  } catch (err) {
    console.error("GET GAME MAP ERROR:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET USER PROGRESS ================= */
exports.getProgress = async (req, res) => {
  try {
    const progress = await UserProgress.findAll({
      where: { userId: req.user.id },
      include: [{
        model: GameLevel,
        attributes: ["title", "levelNumber", "materiName"]
      }]
    });

    res.json({ status: true, data: progress });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= GET SINGLE LEVEL ================= */
exports.getLevel = async (req, res) => {
  try {
    const level = await GameLevel.findByPk(req.params.id, {
      include: [{ model: Badge }]
    });
    
    if (!level) {
      return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
    }

    const questions = await GameQuestion.findAll({
      where: { levelId: level.id },
      order: [["id", "ASC"]],
    });

    // Fix meta JSON
    const fixedQuestions = questions.map(q => {
      let meta = q.meta;
      if (typeof meta === "string") {
        try {
          meta = JSON.parse(meta);
        } catch {
          meta = {};
        }
      }
      return { ...q.dataValues, meta };
    });

    res.json({ status: true, level: level.dataValues, questions: fixedQuestions });
  } catch (err) {
    console.error("GET LEVEL ERROR:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= SUBMIT LEVEL (FULL GAMIFICATION) ================= */
exports.submitLevel = async (req, res) => {
  try {
    const userId = req.user.id;
    const levelId = req.params.id;
    const answers = req.body.answers || [];

    const level = await GameLevel.findByPk(levelId, {
      include: [{ model: Badge }]
    });

    if (!level) {
      return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
    }

    let correct = 0;
    const total = answers.length;

    // Hitung skor
    for (const ans of answers) {
      const q = await GameQuestion.findByPk(ans.questionId);
      if (!q) continue;

      let meta = q.meta;
      if (typeof meta === "string") meta = JSON.parse(meta);

      let isCorrect = false;

      switch (q.type) {
        case "mcq":
          isCorrect = Number(ans.answer) === Number(meta.answerIndex);
          break;
        case "truefalse":
          isCorrect = Boolean(ans.answer) === Boolean(meta.isTrue);
          break;
        case "essay":
        case "typing":
        case "fill":
          isCorrect = String(ans.answer)
            ?.trim()
            ?.toLowerCase() === String(meta.answer)?.trim()?.toLowerCase();
          break;
        case "flashcard":
          isCorrect = ans.answer === 'correct';
          break;
        case "matching":
          isCorrect = meta.pairs?.every((pair, i) => 
            Number(ans.answer?.[i]) === Number(pair.answerIndex)
          ) || false;
          break;
        default:
          isCorrect = false;
      }

      if (isCorrect) correct++;
    }

    const scorePercent = Math.round((correct / total) * 100);
    const passThreshold = 60;
    const isPassed = scorePercent >= passThreshold;
    
    // XP calculation berdasarkan performa
    let gainedXp = 0;
    if (scorePercent >= 90) gainedXp = level.reward_xp * 2;      // Perfect
    else if (scorePercent >= 80) gainedXp = level.reward_xp * 1.5; // Great  
    else if (scorePercent >= passThreshold) gainedXp = level.reward_xp;     // Pass
    else gainedXp = 5; // Participation

    // Simpan/ Update progress
    await UserProgress.upsert({
      userId,
      levelId,
      completed: isPassed,
      score: scorePercent,
      attempts: { [Op.add]: 1 }
    });

    // Tambah XP user
    const user = await User.findByPk(userId);
    user.xp += gainedXp;
    await user.save();

    // Update streak
    const today = new Date().toISOString().split('T')[0];
    let userStreak = await UserStreak.findOne({ where: { userId } });
    
    if (!userStreak) {
      userStreak = await UserStreak.create({
        userId,
        streakCount: 1,
        lastCompleted: today
      });
    } else {
      const lastDate = new Date(userStreak.lastCompleted);
      const todayDate = new Date(today);
      
      if (lastDate.toISOString().split('T')[0] === today) {
        // Sudah main hari ini, streak tetap
      } else if (lastDate.getTime() === todayDate.getTime() - 86400000) {
        // Kemarin main, streak +1
        userStreak.streakCount += 1;
      } else {
        // Gap > 1 hari, reset streak
        userStreak.streakCount = 1;
      }
      userStreak.lastCompleted = today;
      await userStreak.save();
    }

    // Badge untuk perfect score
    let badge = null;
    if (scorePercent === 100 && level.Badge) {
      const [userBadge, created] = await UserBadge.findOrCreate({
        where: { user_id: userId, badge_id: level.Badge.id },
        defaults: { user_id: userId, badge_id: level.Badge.id }
      });
      
      if (created) {
        badge = {
          badge_name: level.Badge.badge_name,
          image: `${process.env.BASE_URL || ''}${level.Badge.image}`,
          description: level.Badge.description
        };
      }
    }

    res.json({
      status: true,
      total,
      correct,
      scorePercent,
      isPassed,
      gainedXp,
      totalXp: user.xp,
      streak: userStreak.streakCount,
      badge
    });

  } catch (err) {
    console.error("SUBMIT LEVEL ERROR:", err);
    res.status(500).json({
      status: false,
      message: err.message,
    });
  }
};

/* ================= GET USER STATS ================= */
exports.getUserStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const user = await User.findByPk(userId, { attributes: ["xp"] });
    const streak = await UserStreak.findOne({ where: { userId } });
    const progress = await UserProgress.findAll({
      where: { userId },
      attributes: ["completed", "score"]
    });
    
    const stats = {
      xp: user?.xp || 0,
      streak: streak?.streakCount || 0,
      totalLevels: progress.length,
      completedLevels: progress.filter(p => p.completed).length,
      avgScore: progress.length > 0 
        ? Math.round(progress.reduce((sum, p) => sum + p.score, 0) / progress.length)
        : 0
    };

    res.json({ status: true, stats });
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