const Materi = require("../../models/Materi");
const GameLevel = require("../../models/GameLevel");
const GameQuestion = require("../../models/GameQuestion");
const Badge = require("../../models/Badge");

// ==================== MATERI ====================
const getMateri = async (req, res) => {
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
const getBadges = async (req, res) => {
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
const getLevelsByMateri = async (req, res) => {
  try {
    const { slug } = req.params;
    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });
    }

    const levels = await GameLevel.findAll({
      where: { materi_id: materi.id },
      order: [["levelNumber", "ASC"]],
      attributes: ['id', 'title', 'levelNumber', 'totalQuestions', 'reward_xp', 'gameType', 'reward_badge_id'],
      include: [{
        model: Badge,
        as: 'Badge',
        attributes: ["id", "badge_name", "image"],
        required: false,
      }],
    });

    res.json({ success: true, data: levels });
  } catch (err) {
    console.error("❌ ERROR getLevelsByMateri:", err);
    res.status(500).json({ success: false, message: "Gagal ambil level" });
  }
};

const addLevel = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log(`➕ addLevel: slug=${slug}`, req.body);

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });
    }

    const level = await GameLevel.create({
      title: req.body.title,
      levelNumber: parseInt(req.body.levelNumber),
      totalQuestions: parseInt(req.body.totalQuestions || 0),
      reward_xp: parseInt(req.body.reward_xp || 0),
      gameType: req.body.gameType || 'mcq',
      reward_badge_id: req.body.reward_badge_id || null,
      materi_id: materi.id,
    });

    console.log(`✅ Level CREATED: ID=${level.id}`);
    res.json({ success: true, data: level });
  } catch (err) {
    console.error("❌ ERROR addLevel:", err);
    res.status(500).json({ success: false, message: "Gagal tambah level" });
  }
};

const updateLevel = async (req, res) => {
  try {
    const { levelId } = req.params;
    console.log(`✏️ updateLevel: ${levelId}`);

    const level = await GameLevel.findByPk(levelId);
    if (!level) {
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

    console.log(`✅ Level UPDATED: ${levelId}`);
    res.json({ success: true, message: "Level berhasil diupdate", data: level });
  } catch (err) {
    console.error("❌ ERROR updateLevel:", err);
    res.status(500).json({ success: false, message: "Gagal update level" });
  }
};

const deleteLevel = async (req, res) => {
  try {
    const { levelId } = req.params;
    console.log(`🗑️ deleteLevel: ${levelId}`);

    const level = await GameLevel.findByPk(levelId);
    if (!level) {
      return res.status(404).json({ success: false, message: "Level tidak ditemukan" });
    }

    // Hapus questions terkait
    await GameQuestion.destroy({ where: { levelId: level.id } });
    await level.destroy();

    console.log(`✅ Level + questions DELETED: ${levelId}`);
    res.json({ success: true, message: "Level berhasil dihapus" });
  } catch (err) {
    console.error("❌ ERROR deleteLevel:", err);
    res.status(500).json({ success: false, message: "Gagal hapus level" });
  }
};

// ==================== LEVEL + QUESTION ====================
// 🔥 FIXED: getLevelWithQuestions - structure konsisten
const getLevelWithQuestions = async (req, res) => {
  try {
    const { slug, levelNumber } = req.params;
    console.log(`🔍 getLevelWithQuestions: ${slug}/${levelNumber}`);

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });

    const level = await GameLevel.findOne({
      where: {
        materi_id: materi.id,
        levelNumber: parseInt(levelNumber),
      },
    });

    if (!level) return res.status(404).json({ success: false, message: "Level tidak ditemukan" });

    const questions = await GameQuestion.findAll({
      where: { levelId: level.id },
      order: [["id", "ASC"]]
    });

    console.log(`✅ ${questions.length} questions loaded!`);
    
    // ✅ FIXED: Structure { success: true, data: { level, questions } }
    res.json({ 
      success: true, 
      data: { 
        level: level, 
        questions: questions 
      } 
    });
  } catch (err) {
    console.error("❌ ERROR:", err.message);
    res.status(500).json({ success: false, message: "Gagal ambil soal" });
  }
};

// ==================== QUESTION CRUD ====================
const addQuestionBySlugLevel = async (req, res) => {
  try {
    const { slug, levelNumber } = req.params;
    const { type, content, meta } = req.body;
    
    console.log(`➕ addQuestion: ${slug}/${levelNumber}`);
    console.log("📥 RAW META:", meta);
    console.log("📥 TYPE:", typeof meta);

    const materi = await Materi.findOne({ where: { slug } });
    if (!materi) {
      return res.status(404).json({ success: false, message: "Materi tidak ditemukan" });
    }

    const level = await GameLevel.findOne({
      where: {
        materi_id: materi.id,
        levelNumber: parseInt(levelNumber),
      },
    });

    if (!level) {
      return res.status(404).json({ success: false, message: "Level tidak ditemukan" });
    }

    // ✅ FIXED: Pastikan meta adalah object dan stringify dengan benar
    const cleanMeta = typeof meta === 'object' ? meta : JSON.parse(JSON.stringify(meta));
    
    console.log("💾 SAVING META:", cleanMeta, typeof cleanMeta);

    const question = await GameQuestion.create({
      levelId: level.id,
      type: type || 'mcq',
      content: content || '',
      meta: JSON.stringify(cleanMeta),
    });

    console.log(`✅ Question CREATED: ID=${question.id}`);
    res.json({ success: true, data: question });
  } catch (err) {
    console.error("❌ ERROR addQuestionBySlugLevel:", err);
    res.status(500).json({ success: false, message: "Gagal tambah soal", error: err.message });
  }
};

// 🔥 FIXED updateQuestion
// 🔥 FIXED updateQuestion
const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, type, meta } = req.body;

    console.log(`✏️ updateQuestion: ${id}`);
    console.log("📥 UPDATE RAW META:", meta);

    const question = await GameQuestion.findByPk(id);
    if (!question) {
      return res.status(404).json({ success: false, message: "Soal tidak ditemukan" });
    }

    // ✅ FIXED: Clean meta sebelum stringify
    const cleanMeta = typeof meta === 'object' ? meta : JSON.parse(JSON.stringify(meta));

    console.log("💾 UPDATING META:", cleanMeta);

    await question.update({
      content: content || question.content,
      type: type || question.type,
      meta: JSON.stringify(cleanMeta),
    });

    console.log(`✅ Question UPDATED: ${id}`);
    res.json({ success: true, message: "Soal berhasil diupdate" });
  } catch (err) {
    console.error("❌ ERROR updateQuestion:", err);
    res.status(500).json({ success: false, message: "Gagal update soal", error: err.message });
  }
};

const deleteQuestion = async (req, res) => {
  try {
    const { questionId } = req.params;
    console.log(`🗑️ deleteQuestion: ${questionId}`);

    const question = await GameQuestion.findByPk(questionId);
    if (!question) {
      return res.status(404).json({ success: false, message: "Soal tidak ditemukan" });
    }

    await question.destroy();
    console.log(`✅ Question DELETED: ${questionId}`);
    res.json({ success: true, message: "Soal berhasil dihapus" });
  } catch (err) {
    console.error("❌ ERROR deleteQuestion:", err);
    res.status(500).json({ success: false, message: "Gagal hapus soal" });
  }
};

// 🔥 EXPORTS
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