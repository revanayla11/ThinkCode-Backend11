// controllers/adminGameController.js
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const Materi = require("../models/Materi");

exports.getMateriGameLevels = async (req, res) => {
  try {
    const levels = await GameLevel.findAll({
      where: { materi_id: req.params.materiId, isActive: true },
      order: [['levelNumber', 'ASC']]
    });
    res.json({ status: true, data: levels });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.getLevelQuestions = async (req, res) => {
  try {
    const questions = await GameQuestion.findAll({
      where: { levelId: req.params.levelId },
      order: [['order', 'ASC']]
    });
    
    const level = await GameLevel.findByPk(req.params.levelId);
    
    res.json({ 
      status: true, 
      questions, 
      level: level.toJSON() 
    });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.createQuestion = async (req, res) => {
  try {
    const question = await GameQuestion.create({
      levelId: req.params.levelId,
      ...req.body
    });
    res.json({ status: true, question });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.updateQuestion = async (req, res) => {
  try {
    const question = await GameQuestion.findByPk(req.params.id);
    if (!question) {
      return res.status(404).json({ status: false, message: "Soal tidak ditemukan" });
    }
    
    await question.update(req.body);
    res.json({ status: true, question });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.deleteQuestion = async (req, res) => {
  try {
    const question = await GameQuestion.findByPk(req.params.id);
    if (!question) {
      return res.status(404).json({ status: false, message: "Soal tidak ditemukan" });
    }
    
    await question.destroy();
    res.json({ status: true, message: "Soal berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};