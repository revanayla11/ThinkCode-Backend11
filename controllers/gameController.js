const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Materi = require("../models/Materi");

const gameController = {
  // 🔥 1. GET GAME MAP - MAIN ENDPOINT
  getGameMap: async (req, res) => {
    try {
      console.log("🗺️ getGameMap - user:", req.user?.id);

      const allLevels = await GameLevel.findAll({
        include: [{ model: Materi, attributes: ["id", "title", "slug"] }],
        order: [["materi_id", "ASC"], ["levelNumber", "ASC"]],
        attributes: ["id", "title", "levelNumber", "materi_id", "reward_xp", "gameType"]
      });

      // Group by materi
      const materiMap = {};
      allLevels.forEach(level => {
        const materiId = level.materi_id;
        const materi = level.Materi;

        if (!materiMap[materiId]) {
          materiMap[materiId] = {
            materiId,
            materiName: materi?.title || `Materi ${materiId}`,
            slug: materi?.slug || "",
            levels: []
          };
        }

        materiMap[materiId].levels.push({
          id: Number(level.id),
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
        const user = await User.findByPk(req.user.id, { attributes: ["xp", "hearts"] });
        const rawProgress = await UserProgress.findAll({
          where: { userId: req.user.id, levelId: { [Op.ne]: null } },
          attributes: ["levelId", "completed", "score", "xp"],
          order: [["updatedAt", "DESC"]]
        });

        progress = rawProgress.map(p => ({
          levelId: Number(p.levelId),
          completed: Boolean(p.completed),
          score: Number(p.score) || 0,
          xp: Number(p.xp) || 0
        }));

        const completedCount = progress.filter(p => p.completed).length;
        userStats = {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          streak: Math.min(completedCount, 7)
        };
      }

      // 🔥 DEBUG LOG
      console.log(`✅ Map sent: ${levels.length} materi, ${progress.length} progress items`);
      console.log("🔍 Sample data:", {
        firstMateriLevels: levels[0]?.levels?.map(l => l.id),
        recentProgress: progress.slice(0, 3).map(p => ({ levelId: p.levelId, completed: p.completed }))
      });

      res.json({ status: true, levels, progress, userStats });

    } catch (err) {
      console.error("❌ getGameMap:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  },

  // 🔥 2. GET SINGLE LEVEL
  getLevel: async (req, res) => {
    try {
      const levelId = req.params.id;
      const level = await GameLevel.findByPk(levelId, {
        include: [{ model: Materi, attributes: ["title"] }]
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
          meta = typeof q.meta === "string" ? JSON.parse(q.meta || "{}") : q.meta || {};
        } catch {
          meta = {};
        }

        return {
          id: q.id,
          content: q.content,
          type: q.type,
          meta,
          options: meta.options || [],
          answerIndex: meta.answerIndex || 0,
          answer: meta.answer || "",
          answers: meta.answers || [],
          isTrue: meta.answer === "true"
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

  // 🔥 3. SUBMIT LEVEL - SELALU SIMPAN PROGRESS (UNLOCK NEXT!)
  submitLevel: async (req, res) => {
    try {
      const userId = req.user.id;
      const levelId = Number(req.params.id);
      const { scorePercent, totalQuestions = 0, correctAnswers = 0, heartsUsed = 1 } = req.body;

      console.log(`🎮 Submit: U${userId} L${levelId} = ${scorePercent}% (${heartsUsed} hearts)`);

            if (!Number.isFinite(scorePercent) || scorePercent > 100 || scorePercent < 0) {
        return res.status(400).json({ status: false, message: "Invalid score" });
      }

      const level = await GameLevel.findByPk(levelId);
      if (!level) {
        return res.status(404).json({ status: false, message: "Level not found" });
      }

      const completed = scorePercent >= 80;
      const rewardXp = completed ? (level.reward_xp || 20) : 0;

      // 🔥 CRITICAL: SELALU SIMPAN PROGRESS - INI YANG UNLOCK LEVEL SELANJUTNYA!
      const [savedProgress, created] = await UserProgress.upsert({
        userId,
        levelId,
        completed,
        score: scorePercent,
        xp: rewardXp,
        stars: Math.floor(scorePercent / 33),
        totalQuestions,
        correctAnswers,
        updatedAt: new Date()
      });

      console.log(`💾 Progress ${created ? 'CREATED' : 'UPDATED'}: L${levelId} completed=${completed}`);

      // Update user XP & hearts
      const user = await User.findByPk(userId);
      if (rewardXp > 0) {
        user.xp = (user.xp || 0) + rewardXp;
      }
      user.hearts = Math.max(0, Math.min(5, (user.hearts || 5) - heartsUsed));
      await user.save();

      // 🔥 DEBUG: Verify saved data
      const verifyProgress = await UserProgress.findOne({ 
        where: { userId, levelId } 
      });
      console.log(`✅ VERIFIED: L${levelId} saved:`, {
        levelId: verifyProgress.levelId,
        completed: verifyProgress.completed,
        score: verifyProgress.score
      });

      console.log(`🎉 User U${userId}: XP=${user.xp}, Hearts=${user.hearts}`);

      res.json({
        status: true,
        data: {
          scorePercent,
          completed,
          rewardXp,
          hearts: user.hearts,
          totalXp: user.xp,
          message: completed ? "🎉 Level completed!" : "💪 Try again!"
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
      const user = await User.findByPk(req.user.id, { attributes: ["xp", "hearts"] });
      const progress = await UserProgress.findAll({
        where: { userId: req.user.id, completed: true },
        attributes: ["levelId"]
      });

      res.json({
        status: true,
        stats: {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          completedLevels: progress.length,
          streak: Math.min(progress.length, 7)
        }
      });
    } catch (err) {
      console.error("❌ getUserStats:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  }
};

module.exports = gameController;