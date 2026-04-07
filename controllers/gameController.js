const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");

const gameController = {
  // 1. GAME MAP (Hearts + Simple Streak)
  getGameMap: async (req, res) => {
  try {
    const allLevels = await GameLevel.findAll({
      order: [["materi_id", "ASC"], ["levelNumber", "ASC"]],
      attributes: ["id", "title", "levelNumber", "materi_id", "reward_xp"]
    });

    // ✅ GROUP BY MATERI_ID
    const materiMap = {};
    allLevels.forEach(level => {
      const materiId = level.materi_id;
      if (!materiMap[materiId]) {
        materiMap[materiId] = {
          materiId,
          materiName: `Materi ${materiId}`, // Dynamic name
          levels: []
        };
      }
      materiMap[materiId].levels.push({
        id: level.id,
        title: level.title,
        levelNumber: level.levelNumber,
        reward_xp: level.reward_xp
      });
    });

    const levels = Object.values(materiMap); // Convert ke array

    let progress = [];
    let userStats = { xp: 0, streak: 1, hearts: 5 };

    if (req.user) {
      progress = await UserProgress.findAll({
        where: { userId: req.user.id },
        attributes: ["levelId", "completed", "score"]
      });

      const user = await User.findByPk(req.user.id, { attributes: ["xp", "hearts"] });
      userStats = {
        xp: user?.xp || 0,
        hearts: user?.hearts || 5,
        streak: progress.length > 0 ? 7 : 1
      };
    }

    res.json({ 
      status: true, 
      levels,  // ✅ Sekarang grouped!
      progress, 
      userStats 
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
},

  // 2. GET LEVEL
  getLevel: async (req, res) => {
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
  },

  // 3. SUBMIT LEVEL (Hearts -1)
  submitLevel: async (req, res) => {
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
          case "essay": case "typing": 
            isCorrect = String(ans.answer).trim().toLowerCase() === String(meta.answer).trim().toLowerCase(); break;
        }
        if (isCorrect) correct++;
      }

      const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
      const gainedXp = Math.max(10, Math.round(scorePercent / 2));

      // Update progress
      await UserProgress.upsert({
        userId, levelId, completed: scorePercent >= 60, score: scorePercent
      });

      // Update XP & Hearts
      const user = await User.findByPk(userId);
      user.xp = (user.xp || 0) + gainedXp;
      
      // Hearts: -1 per attempt (min 0)
      let hearts = user.hearts || 5;
      user.hearts = Math.max(0, hearts - 1);
      await user.save();

      res.json({
        status: true, total, correct, scorePercent, 
        gainedXp, hearts: user.hearts, streak: 7, totalXp: user.xp
      });
    } catch (err) {
      res.status(500).json({ status: false, message: err.message });
    }
  },

  // 4. USER STATS
  getUserStats: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, { attributes: ["xp", "hearts"] });
      res.json({
        status: true,
        stats: {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          streak: 7 // Fake
        }
      });
    } catch (err) {
      res.status(500).json({ status: false, message: err.message });
    }
  },

  // 5. DUMMY PROGRESS & LEADERBOARD
  getProgress: async (req, res) => {
    res.json({ status: true, data: [] });
  },

  getLeaderboard: async (req, res) => {
    res.json({ status: true, leaderboard: [] });
  }
};

module.exports = gameController;