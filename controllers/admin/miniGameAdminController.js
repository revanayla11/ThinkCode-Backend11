const Materi = require("../../models/Materi");
const GameLevel = require("../../models/GameLevel");
const GameQuestion = require("../../models/GameQuestion");
const Badge = require("../../models/Badge");

// ================= MATERI =================
exports.getMateri = async (req, res) => {
  const data = await Materi.findAll();
  res.json({ success: true, data });
};

// ================= LEVEL =================
exports.getLevels = async (req, res) => {
  const materi = await Materi.findOne({ where: { slug: req.params.slug } });
  const levels = await GameLevel.findAll({
    where: { materi_id: materi.id },
  });
  res.json({ success: true, data: levels });
};

exports.addLevel = async (req, res) => {
  const materi = await Materi.findOne({ where: { slug: req.params.slug } });

  const level = await GameLevel.create({
    ...req.body,
    materi_id: materi.id,
  });

  res.json({ success: true, data: level });
};

// ================= QUESTION =================
exports.getQuestions = async (req, res) => {
  const materi = await Materi.findOne({ where: { slug: req.params.slug } });

  const level = await GameLevel.findOne({
    where: { materi_id: materi.id, levelNumber: req.params.levelNumber },
  });

  const questions = await GameQuestion.findAll({
    where: { levelId: level.id },
  });

  res.json({ success: true, questions });
};

exports.addQuestion = async (req, res) => {
  const materi = await Materi.findOne({ where: { slug: req.params.slug } });

  const level = await GameLevel.findOne({
    where: { materi_id: materi.id, levelNumber: req.params.levelNumber },
  });

  const q = await GameQuestion.create({
    levelId: level.id,
    type: req.body.type,
    content: req.body.content,
    meta: JSON.stringify(req.body.meta),
  });

  res.json({ success: true, data: q });
};