const Materi = require("../../models/Materi");
const GameLevel = require("../../models/GameLevel");
const GameQuestion = require("../../models/GameQuestion");
const Badge = require("../../models/Badge");

// ==================== MATERI ====================
exports.getMateri = async (req, res) => {
  try {
    console.log("📚 Loading materi...");
    const materiList = await Materi.findAll({
      order: [["createdAt", "DESC"]]
    });
    console.log(`✅ Found ${materiList.length} materi`);
    res.json({ success: true, data: materiList });
  } catch (err) {
    console.error("❌ ERROR getMateri:", err);
    res.status(500).json({ success: false, message: "Gagal ambil materi" });
  }
};

// ==================== BADGE ====================
exports.getBadges = async (req, res) => {
  try {
    console.log("🏆 Loading badges...");
    const badges = await Badge.findAll();
    console.log(`✅ Found ${badges.length} badges`);
    res.json({ success: true, data: badges });
  } catch (err) {
    console.error("❌ ERROR getBadges:", err);
    res.status(500).json({ success: false, message: "Gagal ambil badge" });
  }
};

// ==================== LEVEL ====================
exports.getLevelsByMateri = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`🔍 getLevelsByMateri: slug=${slug}`);

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      console.log(`❌ Materi not found: ${slug}`);
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
          as: 'Badge', // 🔥 PASTIKAN alias di model
          attributes: ["id", "badge_name", "image"],
          required: false,
        },
      ],
    });

    console.log(`✅ Found ${levels.length} levels for materi ${materi.id}`);
    res.json({ success: true, data: levels });
  } catch (err) {
    console.error("❌ ERROR getLevelsByMateri:", err);
    res.status(500).json({ success: false, message: "Gagal ambil level" });
  }
};

exports.addLevel = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`➕ addLevel: slug=${slug}`, req.body);

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      console.log(`❌ Materi not found: ${slug}`);
      return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });
    }

    const levelData = {
      title: req.body.title,
      levelNumber: parseInt(req.body.levelNumber),
      totalQuestions: parseInt(req.body.totalQuestions),
      reward_xp: parseInt(req.body.reward_xp),
      gameType: req.body.gameType,
      reward_badge_id: req.body.reward_badge_id || null,
      materi_id: materi.id,
    };

    const level = await GameLevel.create(levelData);
    console.log(`✅ Level CREATED: ID=${level.id}, materi_id=${materi.id}`);

    res.json({ success: true, data: level });
  } catch (err) {
    console.error("❌ ERROR addLevel:", err);
    res.status(500).json({ success: false, message: "Gagal tambah level" });
  }
};

exports.updateLevel = async (req, res) => {
  try {
    const { levelId } = req.params;
    console.log(`✏️ updateLevel: ${levelId}`, req.body);

    const level = await GameLevel.findByPk(levelId);
    if (!level) {
      console.log(`❌ Level not found: ${levelId}`);
      return res.status(404).json({ success: false, message: "Level tidak ditemukan" });
    }

    await level.update({
      title: req.body.title,
      levelNumber: parseInt(req.body.levelNumber),
      totalQuestions: parseInt(req.body.totalQuestions),
      reward_xp: parseInt(req.body.reward_xp),
      gameType: req.body.gameType,
      reward_badge_id: req.body.reward_badge_id || null,
    });

    const updatedLevel = await GameLevel.findByPk(levelId, {
      include: [{ 
        model: Badge, 
        as: 'Badge',
        attributes: ["id", "badge_name", "image"] 
      }]
    });

    console.log(`✅ Level UPDATED: ${levelId}`);
    res.json({ success: true, message: "Level berhasil diupdate", data: updatedLevel });
  } catch (err) {
    console.error("❌ ERROR updateLevel:", err);
    res.status(500).json({ success: false, message: "Gagal update level" });
  }
};

exports.deleteLevel = async (req, res) => {
  try {
    const { levelId } = req.params;
    console.log(`🗑️ deleteLevel: ${levelId}`);

    const level = await GameLevel.findByPk(levelId);
    if (!level) {
      console.log(`❌ Level not found: ${levelId}`);
      return res.status(404).json({ success: false, message: "Level tidak ditemukan" });
    }

    // Hapus questions dulu
    await GameQuestion.destroy({ where: { levelId: level.id } });
    await level.destroy();

    console.log(`✅ Level DELETED: ${levelId} + ${await GameQuestion.count({ where: { levelId: level.id } })} questions`);
    res.json({ success: true, message: "Level berhasil dihapus" });
  } catch (err) {
    console.error("❌ ERROR deleteLevel:", err);
    res.status(500).json({ success: false, message: "Gagal hapus level" });
  }
};

// ==================== LEVEL + QUESTION ====================
exports.getLevelWithQuestions = async (req, res) => {
  try {
    const { slug, levelNumber } = req.params;
    console.log(`🔍 getLevelWithQuestions: slug=${slug}, levelNumber=${levelNumber}`);

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      console.log(`❌ Materi not found: ${slug}`);
      return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });
    }

    const level = await GameLevel.findOne({
      where: {
        materi_id: materi.id,
        levelNumber: parseInt(levelNumber),
      },
      include: [
        {
          model: Badge,
          as: 'Badge',
          attributes: ["id", "badge_name", "image"],
          required: false,
        },
      ],
    });

    if (!level) {
      console.log(`❌ Level not found: materi_id=${materi.id}, levelNumber=${levelNumber}`);
      return res.status(404).json({ success: false, message: "Level tidak ditemukan" });
    }

    const questions = await GameQuestion.findAll({
      where: { levelId: level.id },
      order: [["createdAt", "ASC"]]
    });

    console.log(`✅ Level ${level.id} (${level.title}): ${questions.length} questions`);

    res.json({
      success: true,
      data: {
        level,
        questions,
      },
    });
  } catch (err) {
    console.error("❌ ERROR getLevelWithQuestions:", err);
    res.status(500).json({ success: false, message: "Gagal ambil soal" });
  }
};

// ==================== QUESTION CRUD ====================
exports.addQuestionBySlugLevel = async (req, res) => {
  try {
    const { slug, levelNumber } = req.params;
    const { type, content, meta } = req.body;
    
    console.log(`➕ addQuestion: slug=${slug}, level=${levelNumber}, type=${type}, content=${content?.substring(0,50)}`);

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      console.log(`❌ Materi not found: ${slug}`);
      return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });
    }

    const level = await GameLevel.findOne({
      where: {
        materi_id: materi.id,
        levelNumber: parseInt(levelNumber),
      },
    });

    if (!level) {
      console.log(`❌ Level not found: materi_id=${materi.id}, levelNumber=${levelNumber}`);
      return res.status(404).json({ success: false, message: "Level tidak ditemukan" });
    }

    const question = await GameQuestion.create({
      levelId: level.id,
      type: type || 'mcq',
      content: content || '',
      meta: JSON.stringify(meta || {}),
    });

    console.log(`✅ Question CREATED: ID=${question.id}, levelId=${level.id}, type=${type}`);
    
    res.json({
      success: true,
      data: question,
    });
  } catch (err) {
    console.error("❌ ERROR addQuestionBySlugLevel:", err);
    res.status(500).json({ success: false, message: "Gagal tambah soal" });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type, meta } = req.body;
    
    console.log(`✏️ updateQuestion: ${id}, type=${type}`);

    const question = await GameQuestion.findByPk(id);
    if (!question) {
      console.log(`❌ Question not found: ${id}`);
      return res.status(404).json({ success: false, message: "Soal tidak ditemukan" });
    }

    await question.update({
      content: content || question.content,
      type: type || question.type,
      meta: JSON.stringify(meta || JSON.parse(question.meta || '{}')),
    });

    console.log(`✅ Question UPDATED: ${id}`);
    
    const updatedQuestion = await GameQuestion.findByPk(id);
    res.json({
      success: true,
      message: "Soal berhasil diupdate",
      data: updatedQuestion
    });
  } catch (err) {
    console.error("❌ ERROR updateQuestion:", err);
    res.status(500).json({ success: false, message: "Gagal update soal" });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    console.log(`🗑️ deleteQuestion: ${questionId}`);

    const question = await GameQuestion.findByPk(questionId);
    if (!question) {
      console.log(`❌ Question not found: ${questionId}`);
      return res.status(404).json({ success: false, message: "Soal tidak ditemukan" });
    }

    const levelId = question.levelId;
    await question.destroy();

    console.log(`✅ Question DELETED: ${questionId} from level ${levelId}`);
    res.json({ success: true, message: "Soal berhasil dihapus" });
  } catch (err) {
    console.error("❌ ERROR deleteQuestion:", err);
    res.status(500).json({ success: false, message: "Gagal hapus soal" });
  }
};

module.exports = {
  getMateri,
  getBadges,
  getLevelsByMateri,
  addLevel,
  updateLevel,
  deleteLevel,
  getLevelWithQuestions,
  addQuestionBySlugLevel,
  updateQuestion,
  deleteQuestion,
};