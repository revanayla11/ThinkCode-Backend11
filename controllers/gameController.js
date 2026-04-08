const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Materi = require("../models/Materi");

const gameController = {
  // 🔥 1. GET GAME MAP - FIXED variable order
  getGameMap: async (req, res) => {
  try {
    console.log("🗺️ getGameMap user:", req.user?.id);

    // STEP 1-2: Levels (sama)
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
          slug: materi?.slug || '',
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

    // 🔥 FIXED: Progress format EXACTLY seperti frontend expect
    let progress = [];
    let userStats = { xp: 0, streak: 0, hearts: 5 };

    if (req.user) {
      const rawProgress = await UserProgress.findAll({
        where: { 
          userId: req.user.id,
          levelId: { [Op.ne]: null }  // Filter null levelId
        },
        attributes: ["levelId", "completed", "score", "xp"],
        order: [['createdAt', 'DESC']],
        limit: 50
      });

      console.log("🗂️ Raw DB progress:", rawProgress.length, "records");

      // 🔥 TRANSFORM ke format frontend
      progress = rawProgress.map(p => {
        const levelId = Number(p.levelId);
        return {
          levelId: levelId,           // ✅ Frontend expect ini
          id: levelId,                // ✅ Backup
          completed: p.completed === true || p.completed === 1,  // ✅ Boolean
          score: Number(p.score) || 0, // ✅ Number
          xp: Number(p.xp) || 0
        };
      }).filter(p => p.levelId > 0); // Filter invalid

      console.log("📊 Formatted progress:", progress.length, "items");
      console.log("📋 Sample:", progress.slice(0, 2));
    }

    // Stats
    const unlockedCount = progress.filter(p => p.completed && p.score >= 80).length;
    userStats = {
      xp: userStats.xp,
      hearts: userStats.hearts,
      streak: Math.min(unlockedCount, 7)
    };

    res.json({ 
      status: true, 
      levels, 
      progress,  // 🔥 SEKARANG ADA DATA!
      userStats 
    });

  } catch (err) {
    console.error("❌ getGameMap ERROR:", err);
    res.status(500).json({ status: false, message: err.message });
  }
},

  // 🔥 2. GET SINGLE LEVEL
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

  // 🔥 3. SUBMIT LEVEL - PERFECT SCORE + UNLOCK
  submitLevel: async (req, res) => {
    try {
      const userId = req.user.id;
      const levelId = req.params.id;
      const { scorePercent, totalQuestions, correctAnswers, heartsUsed = 1 } = req.body;

      console.log(`🎮 Submit ${userId}: Level ${levelId} = ${scorePercent}% (${correctAnswers}/${totalQuestions})`);

      // VALIDATION
      if (!scorePercent || !Number.isInteger(scorePercent) || scorePercent > 100 || scorePercent < 0) {
        return res.status(400).json({ 
          status: false, 
          message: `Invalid scorePercent: ${scorePercent}` 
        });
      }

      const level = await GameLevel.findByPk(levelId);
      if (!level) {
        return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
      }

      // FIRST COMPLETION CHECK (80%+ only)
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
      
      // 🔥 PERFECT BONUS: 100% = full reward, 80-99% = scaled
      const rewardXp = isFirstCompletion && completed 
        ? Math.round(perfectReward * (scorePercent / 100)) 
        : 0;

      // SAVE PROGRESS
      await UserProgress.upsert({
        userId,
        levelId,
        xp: rewardXp,
        stars: completed ? 3 : Math.floor(scorePercent / 30),
        completed,
        score: scorePercent  // DB field
      });

      // UPDATE USER XP + HEARTS
      const user = await User.findByPk(userId);
      if (rewardXp > 0) {
        user.xp += rewardXp;
      }
      user.hearts = Math.max(0, (user.hearts || 5) - heartsUsed);
      await user.save();

      console.log(`✅ Level ${level.levelNumber}: ${completed ? '✅ COMPLETED' : '❌ FAILED'} ${scorePercent}% +${rewardXp}XP hearts:${user.hearts}`);

      // 🔥 PROPER RESPONSE STRUCTURE
      res.json({
        status: true,
        data: {
          scorePercent,
          rewardXp,
          totalXp: user.xp,
          hearts: user.hearts,
          completed,
          isFirstCompletion,
          perfectReward,
          message: completed ? "🎉 Level unlocked!" : "📚 Target 80%+ untuk unlock!"
        }
      });

    } catch (err) {
      console.error("❌ submitLevel:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  },

  // 🔥 4. USER STATS
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