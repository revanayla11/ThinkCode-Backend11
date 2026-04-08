const { Op } = require("sequelize");
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Materi = require("../models/Materi");

const gameController = {

  // 🔥 1. GET GAME MAP
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

        // 🔥 GET ALL PROGRESS (NO FILTER)
        const rawProgress = await UserProgress.findAll({
          where: {
            userId: req.user.id,
            levelId: { [Op.ne]: null }
          },
          attributes: ["levelId", "completed", "score", "xp"],
          order: [["updatedAt", "DESC"]]
        });

        console.log("🗂️ Raw progress:", rawProgress.length);

        // 🔥 FORMAT PROGRESS
        progress = rawProgress.map(p => ({
          levelId: Number(p.levelId),
          id: Number(p.levelId),
          completed: p.completed === true || p.completed === 1,
          score: Number(p.score) || 0,
          xp: Number(p.xp) || 0
        }));

        // ✅ USER STATS
        const completedCount = progress.filter(p => p.completed).length;
        userStats = {
          xp: user?.xp || 0,
          hearts: user?.hearts || 5,
          streak: Math.min(completedCount, 7)
        };
      }

      res.json({
        status: true,
                status: true,
        levels,
        progress,  // ✅ Kirim SEMUA progress (frontend yang filter)
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

  // 🔥 3. SUBMIT LEVEL - COMPLETION BASED ✅
submitLevel: async (req, res) => {
  try {
    const { scorePercent } = req.body;
    const userId = req.user.id;
    const levelId = Number(req.params.id); // 🔥 NUMBER!

    // SELALU SIMPAN - INI PENTING!
    await UserProgress.upsert({
      userId,
      levelId,  // Number
      completed: scorePercent >= 80,
      score: scorePercent,
      updatedAt: new Date()
    });

    console.log(`✅ SAVED: user ${userId}, level ${levelId}, score ${scorePercent}%`);

    res.json({ status: true, completed: scorePercent >= 80 });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
}

  // 🔥 4. USER STATS
  getUserStats: async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: ["xp", "hearts"]
      });

      const progress = await UserProgress.findAll({
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
          completedLevels: progress.length,
          streak: Math.min(progress.length, 7),
          totalProgress: await UserProgress.count({
            where: { userId: req.user.id }
          })
        }
      });

    } catch (err) {
      console.error("❌ getUserStats:", err);
      res.status(500).json({ status: false, message: err.message });
    }
  }
};

module.exports = gameController;