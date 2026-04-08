const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Materi = require("../models/Materi");

const gameController = {

  // 🔥 1. GET GAME MAP (FIX TOTAL)
  getGameMap: async (req, res) => {
    try {
      console.log("🗺️ getGameMap user:", req.user?.id);

      // ✅ GET ALL LEVELS
      const allLevels = await GameLevel.findAll({
        include: [{ model: Materi, attributes: ["id", "title", "slug"] }],
        order: [["materi_id", "ASC"], ["levelNumber", "ASC"]],
        attributes: ["id", "title", "levelNumber", "materi_id", "reward_xp", "gameType"]
      });

      // ✅ GROUP BY MATERI
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
          id: level.id,
          title: level.title,
          levelNumber: level.levelNumber,
          reward_xp: level.reward_xp || 20,
          gameType: level.gameType
        });
      });

      const levels = Object.values(materiMap);

      // ✅ DEFAULT
      let progress = [];
      let userStats = { xp: 0, streak: 0, hearts: 5 };

      // ✅ GET USER DATA
      if (req.user) {
        const user = await User.findByPk(req.user.id, {
          attributes: ["xp", "hearts"]
        });

        // 🔥 GET PROGRESS (NO LIMIT ❗)
        const rawProgress = await UserProgress.findAll({
          where: {
            userId: req.user.id,
            levelId: { [Op.ne]: null }
          },
          attributes: ["levelId", "completed", "score", "xp"]
        });

        console.log("🗂️ Raw progress:", rawProgress.length);

        // 🔥 FORMAT PROGRESS (CLEAN)
        progress = rawProgress.map(p => ({
          levelId: Number(p.levelId),
          id: Number(p.levelId),
          completed: p.completed === true || p.completed === 1,
          score: Number(p.score) || 0,
          xp: Number(p.xp) || 0
        }));

        // 🔥 FILTER VALID (80%+ ONLY)
        const validProgress = progress.filter(p => p.completed && p.score >= 80);

        console.log("✅ Valid progress:", validProgress.length);

        // ✅ USER STATS
        userStats = {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          streak: Math.min(validProgress.length, 7)
        };

        // ❗ PENTING: kirim semua progress (bukan cuma valid)
        // biar frontend bisa cek sendiri
      }

      res.json({
        status: true,
        levels,
        progress,
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
        include: [{ model: Materi, attributes: ["title"] }]
      });

      if (!level) {
        return res.status(404).json({
          status: false,
          message: "Level tidak ditemukan"
        });
      }

      const questions = await GameQuestion.findAll({
        where: { levelId: level.id },
        order: [["id", "ASC"]]
      });

      const fixedQuestions = questions.map(q => {
        let meta = {};

        try {
          meta = typeof q.meta === "string"
            ? JSON.parse(q.meta || "{}")
            : (q.meta || {});
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

  // 🔥 3. SUBMIT LEVEL (FIX TOTAL)
  submitLevel: async (req, res) => {
    try {
      const userId = req.user.id;
      const levelId = req.params.id;
      const { scorePercent, totalQuestions, correctAnswers, heartsUsed = 1 } = req.body;

      console.log(`🎮 Submit ${userId}: Level ${levelId} = ${scorePercent}%`);

      // ❗ VALIDASI FIX (0 BOLEH)
      if (
        scorePercent === undefined ||
        !Number.isInteger(scorePercent) ||
        scorePercent > 100 ||
        scorePercent < 0
      ) {
        return res.status(400).json({
          status: false,
          message: `Invalid scorePercent: ${scorePercent}`
        });
      }

      const level = await GameLevel.findByPk(levelId);
      if (!level) {
        return res.status(404).json({
          status: false,
          message: "Level tidak ditemukan"
        });
      }

      const completed = scorePercent >= 80;

      // 🔥 CEK FIRST COMPLETION
      const existing = await UserProgress.findOne({
        where: {
          userId,
          levelId,
          completed: true,
          score: { [Op.gte]: 80 }
        }
      });

      const isFirstCompletion = !existing;
      const baseXp = level.reward_xp || 20;

      const rewardXp = (completed && isFirstCompletion)
        ? Math.round(baseXp * (scorePercent / 100))
        : 0;

      // 🔥 UPSERT (PASTI UPDATE)
      await UserProgress.upsert({
        userId,
        levelId,
        completed,
        score: scorePercent,
        xp: rewardXp,
        stars: completed ? 3 : Math.floor(scorePercent / 30)
      });

      // 🔥 UPDATE USER
      const user = await User.findByPk(userId);
      if (rewardXp > 0) {
        user.xp += rewardXp;
      }

      user.hearts = Math.max(0, (user.hearts || 5) - heartsUsed);
      await user.save();

      console.log("✅ SAVED PROGRESS:", {
        levelId,
        completed,
        scorePercent
      });

      res.json({
        status: true,
        data: {
          scorePercent,
          rewardXp,
          totalXp: user.xp,
          hearts: user.hearts,
          completed,
          isFirstCompletion,
          message: completed
            ? "🎉 Level unlocked!"
            : "📚 Butuh ≥80% untuk unlock"
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