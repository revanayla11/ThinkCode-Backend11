// controllers/gameController.js - FULL VERSION
const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Materi = require("../models/Materi");

const gameController = {
  // 1. GAME MAP
  getGameMap: async (req, res) => {
    try {
      const allLevels = await GameLevel.findAll({
        include: [{
          model: Materi,
          attributes: ['id', 'title', 'slug']
        }],
        order: [["materi_id", "ASC"], ["levelNumber", "ASC"]],
        attributes: ["id", "title", "levelNumber", "materi_id", "reward_xp", "gameType"]
      });

      const materiMap = {};
      allLevels.forEach(level => {
        const materiId = level.materi_id;
        const materi = level.Materi;
        
        if (!materiMap[materiId]) {
          materiMap[materiId] = {
            materiId,
            materiName: materi?.title || `Materi ${materiId}`,
            slug: materi?.slug,
            levels: []
          };
        }
        materiMap[materiId].levels.push({
          id: level.id,
          title: level.title,
          levelNumber: level.levelNumber,
          reward_xp: level.reward_xp,
          gameType: level.gameType
        });
      });

      const levels = Object.values(materiMap);
      let progress = [];
      let userStats = { xp: 0, streak: 0, hearts: 5 };

      if (req.user) {
        // 🔥 GET USER REAL DATA
        const user = await User.findByPk(req.user.id, { 
          attributes: ["id", "xp", "hearts"] 
        });
        
        progress = await UserProgress.findAll({
          where: { userId: req.user.id },
          attributes: ["levelId", "completed", "score"]
        });

        userStats = {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          streak: progress.filter(p => p.completed).length
        };
      }

      res.json({ 
        status: true, 
        levels, 
        progress, 
        userStats 
      });
    } catch (err) {
      console.error("❌ getGameMap:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  },

  // 2. GET SINGLE LEVEL
  getLevel: async (req, res) => {
    try {
      const levelId = req.params.id;
      
      const level = await GameLevel.findByPk(levelId, {
        include: [{ 
          model: Materi, 
          attributes: ['title'] 
        }]
      });
      
      if (!level) {
        return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
      }

      const questions = await GameQuestion.findAll({
        where: { levelId: level.id },
        order: [["id", "ASC"]]
      });

      const fixedQuestions = questions.map(q => {
        let meta = {};
        try {
          meta = typeof q.meta === 'string' ? JSON.parse(q.meta || '{}') : (q.meta || {});
        } catch (e) {
          meta = {};
        }
        
        return { 
          id: q.id,
          content: q.content,
          type: q.type,
          meta,
          // Legacy fields
          options: meta.options || [],
          answerIndex: meta.answerIndex || 0,
          answer: meta.answer || '',
          answers: meta.answers || [],
          isTrue: meta.answer === 'true'
        };
      });

      res.json({ 
        status: true, 
        level: {
          ...level.dataValues,
          materiTitle: level.Materi?.title
        }, 
        questions: fixedQuestions 
      });
    } catch (err) {
      console.error("❌ getLevel:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  },

  // 🔥 3. SUBMIT LEVEL - XP KE DATABASE USER!
  submitLevel: async (req, res) => {
    try {
      const userId = req.user.id;
      const levelId = req.params.id;
      const { answers, scorePercent } = req.body; // Frontend kirim score

      console.log(`🎮 User ${userId} submit level ${levelId}, score: ${scorePercent}%`);

      const level = await GameLevel.findByPk(levelId);
      if (!level) {
        return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
      }

      // 🔥 CALCULATE REAL REWARD XP
      const completed = scorePercent >= 60;
      const rewardXp = Math.round((scorePercent / 100) * level.reward_xp);
      
      // 1. UPDATE USER PROGRESS
      await UserProgress.upsert({
        userId,
        levelId,
        completed,
        score: scorePercent
      });

      // 🔥 2. UPDATE USER XP & HEARTS DI DATABASE!
      const user = await User.findByPk(userId);
      if (!user) {
        return res.status(404).json({ status: false, message: "User tidak ditemukan" });
      }

      const oldXp = user.xp || 0;
      const oldHearts = user.hearts || 5;
      
      // Tambah XP
      user.xp = oldXp + rewardXp;
      // Kurangi 1 heart per attempt
      user.hearts = Math.max(0, oldHearts - 1);
      
      await user.save();

      console.log(`✅ XP Updated: ${oldXp} → ${user.xp} (+${rewardXp}) | Hearts: ${oldHearts} → ${user.hearts}`);

      res.json({
        status: true,
        scorePercent,
        rewardXp,
        totalXp: user.xp,
        hearts: user.hearts,
        completed,
        message: completed ? "Level completed! 🎉" : "Coba lagi! 💪"
      });
    } catch (err) {
      console.error("❌ submitLevel:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  },

  // 4. GET USER STATS
  getUserStats: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, { 
        attributes: ["xp", "hearts"] 
      });
      
      const progress = await UserProgress.count({
        where: { 
          userId: req.user.id, 
          completed: true 
        }
      });

      res.json({
        status: true,
        stats: {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          completedLevels: progress,
          streak: progress > 0 ? 7 : 0
        }
      });
    } catch (err) {
      res.status(500).json({ status: false, message: err.message });
    }
  }
};

module.exports = gameController;