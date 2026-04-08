const Materi = require("../../models/Materi");
const GameLevel = require("../../models/GameLevel");
const GameQuestion = require("../../models/GameQuestion");
const Badge = require("../../models/Badge");

// ==================== MATERI ====================
exports.getMateri = async (req, res) => {
  try {
    const materiList = await Materi.findAll({
      order: [["createdAt", "DESC"]]
    });
    res.json({ success: true, data: materiList });
  } catch (err) {
    console.error("ERROR getMateri:", err);
    res.status(500).json({ success: false, message: "Gagal ambil materi" });
  }
};

// ==================== BADGE ====================
exports.getBadges = async (req, res) => {
  try {
    const badges = await Badge.findAll();
    res.json({ success: true, data: badges });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal ambil badge" });
  }
};

// ==================== LEVEL ====================
exports.getLevelsByMateri = async (req, res) => {
  try {
    const { slug } = req.params;
    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });
    }

    const levels = await GameLevel.findAll({
      where: { materi_id: materi.id },
      order: [["levelNumber", "ASC"]],
      attributes: [
        'id', 'title', 'levelNumber', 'totalQuestions', 'reward_xp', 
        'gameType', 'reward_badge_id'
      ], 
      include: [
        {
          model: Badge,
          attributes: ["id", "badge_name", "image"],
          required: false,
        },
      ],
    });

    res.json({ success: true, data: levels });
  } catch (err) {
    console.error("ERROR getLevels:", err);
    res.status(500).json({ success: false, message: "Gagal ambil level" });
  }
};

exports.addLevel = async (req, res) => {
  try {
    const { slug } = req.params;
    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });
    }

    const level = await GameLevel.create({
      title: req.body.title,
      levelNumber: req.body.levelNumber,
      totalQuestions: req.body.totalQuestions,
      reward_xp: req.body.reward_xp,
      gameType: req.body.gameType,
      reward_badge_id: req.body.reward_badge_id || null,
      materi_id: materi.id,
    });

    res.json({ success: true, data: level });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal tambah level" });
  }
};

exports.updateLevel = async (req, res) => {
  try {
    const { levelId } = req.params;
    const level = await GameLevel.findByPk(levelId);
    if (!level) {
      return res.status(404).json({ success: false, message: "Level tidak ditemukan" });
    }

    await level.update({
      title: req.body.title,
      levelNumber: req.body.levelNumber,
      totalQuestions: req.body.totalQuestions,
      reward_xp: req.body.reward_xp,
      gameType: req.body.gameType,
      reward_badge_id: req.body.reward_badge_id || null,
    });

    const updatedLevel = await GameLevel.findByPk(levelId, {
      include: [{ model: Badge, attributes: ["id", "badge_name", "image"] }]
    });

    res.json({ success: true, message: "Level berhasil diupdate", data: updatedLevel });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal update level" });
  }
};

exports.deleteLevel = async (req, res) => {
  try {
    const { levelId } = req.params;

    const level = await GameLevel.findByPk(levelId);
    if (!level) {
      return res.status(404).json({
        success: false,
        message: "Level tidak ditemukan",
      });
    }

    await level.destroy();

    res.json({
      success: true,
      message: "Level berhasil dihapus",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Gagal hapus level",
    });
  }
};

// ==================== LEVEL + QUESTION ====================
exports.getLevelWithQuestions = async (req, res) => {
  try {
    const { slug, levelNumber } = req.params;

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({
        success: false,
        message: "Materi tidak ditemukan",
      });
    }

    const level = await GameLevel.findOne({
      where: {
        materi_id: materi.id,
        levelNumber: parseInt(levelNumber),
      },
      include: [
        {
          model: Badge,
          attributes: ["id", "badge_name", "image"],
          required: false,
        },
      ],
    });

    if (!level) {
      return res.status(404).json({
        success: false,
        message: "Level tidak ditemukan",
      });
    }

    const questions = await GameQuestion.findAll({
      where: { levelId: level.id },
      order: [["createdAt", "ASC"]]
    });

    res.json({
      success: true,
      data: {
        level,
        questions,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Gagal ambil soal",
    });
  }
};

// ==================== QUESTION ====================
exports.addQuestionBySlugLevel = async (req, res) => {
  try {
    const { slug, levelNumber } = req.params;
    const { type, content, meta } = req.body;

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({
        success: false,
        message: "Materi tidak ditemukan",
      });
    }

    const level = await GameLevel.findOne({
      where: {
        materi_id: materi.id,
        levelNumber: parseInt(levelNumber),
      },
    });

    if (!level) {
      return res.status(404).json({
        success: false,
        message: "Level tidak ditemukan",
      });
    }

    const question = await GameQuestion.create({
      levelId: level.id,
      type,
      content,
      meta: JSON.stringify(meta || {}),
    });

    res.json({
      success: true,
      data: question,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Gagal tambah soal",
    });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type, meta } = req.body;

    const question = await GameQuestion.findByPk(id);
    if (!question) {
      return res.status(404).json({
        success: false,
        message: "Soal tidak ditemukan",
      });
    }

    await question.update({
      content,
      type,
      meta: JSON.stringify(meta || {}),
    });

    const updatedQuestion = await GameQuestion.findByPk(id);
    res.json({
      success: true,
      message: "Soal berhasil diupdate",
      data: updatedQuestion
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Gagal update soal",
    });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;

    const q = await GameQuestion.findByPk(questionId);
    if (!q) {
      return res.status(404).json({
        success: false,
        message: "Soal tidak ditemukan",
      });
    }

    await q.destroy();

    res.json({
      success: true,
      message: "Soal berhasil dihapus",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Gagal hapus soal",
    });
  }
};