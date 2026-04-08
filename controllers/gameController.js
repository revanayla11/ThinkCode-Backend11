const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Materi = require("../models/Materi");

const gameController = {
  // 🔥 FIXED getGameMap - Debug progress
  // 🔥 FIXED getGameMap - Include ALL progress, filter client-side
getGameMap: async (req, res) => {
  try {
    // ... levels logic sama ...

    let progress = [];
    let userStats = { xp: 0, streak: 0, hearts: 5 };

    if (req.user) {
      const user = await User.findByPk(req.user.id, { 
        attributes: ["id", "xp", "hearts"] 
      });
      
      // 🔥 GET ALL USER PROGRESS - Filter di frontend
      progress = await UserProgress.findAll({
        where: { userId: req.user.id },
        attributes: ["levelId", "completed", "score", "xp"]
      });

      userStats = {
        xp: user?.xp || 0,
        hearts: user?.hearts || 5,
        streak: progress.filter(p => p.completed && p.score >= 80).length
      };
    }

    console.log(`🗺️ Map: ${levels.length} materi, total progress: ${progress.length}`);
    console.log("📊 Progress sample:", progress.slice(0, 3));

    res.json({ 
      status: true, 
      levels, 
      progress,  // ← ALL progress, not filtered
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
// 🔥 FIXED submitLevel - Proper response structure
submitLevel: async (req, res) => {
  try {
    const userId = req.user.id;
    const levelId = req.params.id;
    const { scorePercent, totalQuestions, correctAnswers, heartsUsed = 1 } = req.body;

    console.log(`🎮 Submit ${userId}: Level ${levelId} = ${scorePercent}% (${correctAnswers}/${totalQuestions})`);

    // 🔥 VALIDASI
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

    // 🔥 FIRST COMPLETION CHECK
    const existingProgress = await UserProgress.findOne({
      where: { userId, levelId, completed: true, score: { [Op.gte]: 80 } }
    });

    const isFirstCompletion = !existingProgress;
    const completed = scorePercent >= 80;
    const perfectReward = level.reward_xp || 20;
    const rewardXp = isFirstCompletion && completed 
      ? Math.round(perfectReward * (scorePercent / 100)) 
      : 0;

    // 🔥 UPSERT PROGRESS
    await UserProgress.upsert({
      userId,
      levelId,
      xp: rewardXp,
      stars: completed ? 3 : Math.floor(scorePercent / 30),
      completed,
      score: scorePercent  // Save to DB
    });

    // 🔥 UPDATE USER
    const user = await User.findByPk(userId);
    if (rewardXp > 0) {
      user.xp += rewardXp;
    }
    user.hearts = Math.max(0, (user.hearts || 5) - heartsUsed);
    await user.save();

    console.log(`✅ Saved: ${completed ? 'COMPLETED' : 'FAILED'} ${scorePercent}% +${rewardXp}XP`);

    // 🔥 PROPER RESPONSE STRUCTURE
    res.json({
      status: true,
      data: {  // ← WRAP in data object
        scorePercent,
        rewardXp,
        totalXp: user.xp,
        hearts: user.hearts,
        completed,
        isFirstCompletion,
        perfectReward
      }
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