const Materi = require("../../models/Materi");
const GameLevel = require("../../models/GameLevel");
const GameQuestion = require("../../models/GameQuestion");
const Badge = require("../../models/Badge");

// ==================== BADGE ====================
exports.getBadges = async (req, res) => {
  const badges = await Badge.findAll();
  res.json({ success: true, data: badges });
};


// ==================== MATERI ====================
exports.getMateri = async (req, res) => {
  try {
    const materi = await Materi.findAll({
      attributes: ["id", "title", "slug"],
      order: [["order", "ASC"]],
    });
    res.json({ success: true, data: materi });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

// ==================== LEVEL ====================
exports.getLevelsByMateri = async (req, res) => {
  try {
    const { slug } = req.params;

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({ success: false, message: "Materi not found" });
    }

    const levels = await GameLevel.findAll({
      where: { materi_id: materi.id },
      order: [["levelNumber", "ASC"]],
      include: {
        model: Badge,
        attributes: ["id", "badge_name", "image"],
      },
    });

    res.json({ success: true, data: levels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

exports.addLevel = async (req, res) => {
  try {
    const materi = await Materi.findOne({
      where: { slug: req.params.slug },
    });
    if (!materi) return res.status(404).json({ message: "Materi not found" });

    const level = await GameLevel.create({
      title: req.body.title,
      levelNumber: req.body.levelNumber,
      totalQuestions: req.body.totalQuestions,
      reward_xp: req.body.reward_xp,
      reward_badge_id: req.body.reward_badge_id || null,
      materi_id: materi.id,
    });

    res.json({ success: true, data: level });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.updateLevel = async (req, res) => {
  try {
    const { levelId } = req.params;
    const { title, levelNumber, totalQuestions, reward_xp, reward_badge_id } = req.body;

    const level = await GameLevel.findByPk(levelId);
    if (!level) {
      return res.status(404).json({ success: false, message: "Level not found" });
    }

    await level.update({
      title,
      levelNumber,
      totalQuestions,
      reward_xp,
      reward_badge_id: reward_badge_id || null,
    });

    res.json({ success: true, message: "Level berhasil diupdate", data: level });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal update level" });
  }
};


// ==================== LEVEL + QUESTION ====================
exports.getLevelWithQuestions = async (req, res) => {
  try {
    const { slug, levelNumber } = req.params;

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({ success: false, message: "Materi not found" });
    }

    const level = await GameLevel.findOne({
      where: { materi_id: materi.id, levelNumber },
    });

    if (!level) {
      return res.status(404).json({ success: false, message: "Level not found" });
    }

    const questions = await GameQuestion.findAll({
      where: { levelId: level.id },
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
    res.status(500).json({ success: false });
  }
};

// ==================== QUESTION ====================
exports.addQuestionBySlugLevel = async (req, res) => {
  try {
    const { slug, levelNumber } = req.params;
    const { type, content, meta } = req.body;

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({ success: false });
    }

    const level = await GameLevel.findOne({
      where: { materi_id: materi.id, levelNumber },
    });

    if (!level) {
      return res.status(404).json({ success: false });
    }

    const question = await GameQuestion.create({
      levelId: level.id,
      type,
      content,
      meta: JSON.stringify(meta),
    });

    res.json({ success: true, data: question });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    await GameQuestion.destroy({ where: { id: req.params.questionId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

exports.deleteLevel = async (req, res) => {
  try {
    await GameLevel.destroy({ where: { id: req.params.levelId } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
};

// ==================== UPDATE QUESTION ====================
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
      meta: JSON.stringify(meta),
    });

    res.json({
      success: true,
      message: "Soal berhasil diupdate",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Gagal update soal",
    });
  }
};
