const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Materi = require("../models/Materi");

const gameController = {
  // 🔥 FIXED getGameMap - Debug progress
  getGameMap: async (req, res) => {
    try {
      const allLevels = await GameLevel.findAll({
        include: [{ model: Materi, attributes: ['id', 'title', 'slug'] }],
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
          reward_xp: level.reward_xp || 20,
          gameType: level.gameType
        });
      });

      const levels = Object.values(materiMap);
      let progress = [];
      let userStats = { xp: 0, streak: 0, hearts: 5 };

      if (req.user) {
        const user = await User.findByPk(req.user.id, { 
          attributes: ["id", "xp", "hearts"] 
        });
        
        // 🔥 FIXED: score >= 80 (DB field = score)
        progress = await UserProgress.findAll({
          where: { 
            userId: req.user.id,
            completed: true,
            score: { [Op.gte]: 80 }  // ← DB field 'score'
          },
          attributes: ["levelId", "completed", "score", "xp"]  // ← score dari DB!
        });

        userStats = {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          streak: progress.length
        };
      }

      console.log(`🗺️ Map: ${levels.length} materi, unlocked: ${progress.length}`);
      console.log("🔍 Sample progress:", progress.slice(0, 3));

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

  // 🔥 3. SUBMIT LEVEL - FIRST TIME XP + 80% UNLOCK + GURU REWARD!
    submitLevel: async (req, res) => {
    try {
      const userId = req.user.id;
      const levelId = req.params.id;
      const { scorePercent, totalQuestions, correctAnswers, heartsUsed = 1 } = req.body;

      console.log(`🎮 Submit ${userId}: Level ${levelId} = ${scorePercent}%`);

      if (!scorePercent || scorePercent > 100 || scorePercent < 0) {
        return res.status(400).json({ 
          status: false, 
          message: `Invalid scorePercent: ${scorePercent}` 
        });
      }

      const level = await GameLevel.findByPk(levelId);
      if (!level) {
        return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
      }

      // 🔥 CEK FIRST COMPLETION >=80%
      const existingProgress = await UserProgress.findOne({
        where: {
          userId,
          levelId,
          completed: true,
          score: { [Op.gte]: 80 }
        }
      });

      const isFirstCompletion = !existingProgress;
      const completed = scorePercent >= 80;
      const perfectReward = level.reward_xp || 20;
      const rewardXp = isFirstCompletion 
        ? Math.round(perfectReward * (scorePercent / 100))
        : 0;

      console.log(`📊 Level ${level.levelNumber}: 
        ${completed ? '✅' : '❌'} ${scorePercent}% | 
        ${isFirstCompletion ? `+${rewardXp}XP` : 'No XP'} | 
        Perfect: ${perfectReward}XP`);

      // 🔥 UPSERT - scorePercent → score (DB field)
      await UserProgress.upsert({
        userId,
        levelId,
        xp: rewardXp,
        stars: completed ? 3 : Math.floor(scorePercent / 30),
        completed,
        score: scorePercent  // ← scorePercent disimpan ke 'score'
      });

      // Update user XP + hearts
      const user = await User.findByPk(userId);
      if (rewardXp > 0) {
        user.xp += rewardXp;
      }
      user.hearts = Math.max(0, (user.hearts || 5) - heartsUsed);
      await user.save();

      res.json({
        status: true,
        scorePercent,
        rewardXp,
        totalXp: user.xp,
        hearts: user.hearts,
        completed,
        isFirstCompletion,
        perfectReward,
        message: completed ? "Level unlocked! 🎉" : "Target 80%+ untuk unlock!"
      });

    } catch (err) {
      console.error("❌ submitLevel:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  },

  // 4. USER STATS
  getUserStats: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, { 
        attributes: ["xp", "hearts"] 
      });
      
      const progress = await UserProgress.findAll({
        where: { 
          userId: req.user.id, 
          completed: true,
          score: { [Op.gte]: 80 }
        }
      });

      res.json({
        status: true,
        stats: {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          completedLevels: progress.length,
          unlockedLevels: progress.length,
          streak: progress.length >= 7 ? 7 : progress.length
        }
      });
    } catch (err) {
      console.error("❌ getUserStats:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  }
};

module.exports = gameController;