const User = require("../models/User");
const Materi = require("../models/Materi");
const MateriSection = require("../models/MateriSection");
const UserMateriProgress = require("../models/UserMateriProgress");
const Clue = require("../models/Clue");
const DiscussionRoom = require("../models/DiscussionRoom");
const Upload = require("../models/Upload");
const MateriAnswer = require("../models/MateriAnswer");
const fs = require("fs");
const path = require("path");

const STEPS = ["watch_video", "open_mini_lesson", "join_discussion", "submit_answer"];

const XP_MAP = {
  watch_video: 10,
  open_mini_lesson: 15,
  join_discussion: 20,
  submit_answer: 50
};

// ================= MATERI CRUD =================
exports.listMateri = async (req, res) => {
  try {
    const materi = await Materi.findAll({ order: [["order", "ASC"]] });
    let progressMap = {};

    if (req.user?.id) {
      const ups = await UserMateriProgress.findAll({
        where: { userId: req.user.id }
      });
      ups.forEach(p => progressMap[p.materiId] = p);
    }

    const data = materi.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      progress: progressMap[m.id]?.percent || 0,
      xp: progressMap[m.id]?.xp || 0
    }));

    res.json({ status: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getMateri = async (req, res) => {
  const m = await Materi.findByPk(req.params.id);
  if (!m) return res.status(404).json({ error: "Not found" });
  res.json(m);
};

exports.createMateri = async (req, res) => {
  try {
    const m = await Materi.create(req.body);
    res.json({ status: true, data: m });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Failed to create" });
  }
};

exports.updateMateri = async (req, res) => {
  try {
    const m = await Materi.findByPk(req.params.id);
    if (!m) return res.status(404).json({ status: false, message: "Not found" });
    await m.update(req.body);
    res.json({ status: true, data: m });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Failed to update" });
  }
};

exports.deleteMateri = async (req, res) => {
  try {
    const m = await Materi.findByPk(req.params.id);
    if (!m) return res.status(404).json({ status: false, message: "Not found" });
    await m.destroy();
    res.json({ status: true, message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Failed to delete" });
  }
};

// ================= GET DETAIL MATERI (PERBAIKAN LENGKAP) =================
exports.getMateriDetail = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user?.id;

    const materi = await Materi.findByPk(id, {
      include: [
        {
          model: MateriSection,
          as: 'sections',
          order: [['order', 'ASC']]
        },
        {
          model: Clue,
          order: [['id', 'ASC']]
        }
      ]
    });

    if (!materi) {
      return res.status(404).json({ 
        status: false, 
        message: "Materi tidak ditemukan" 
      });
    }

    // Filter sections untuk frontend
    const sections = materi.sections.map(s => ({
      id: s.id,
      type: s.type,
      content: s.content,
      title: s.title,
      order: s.order
    }));

    const videoSection = sections.find(s => s.type === "video" && s.content);
    const miniSection = sections.find(s => s.type === "mini");

    let progress = null;
    if (userId) {
      const up = await UserMateriProgress.findOne({ 
        where: { userId, materiId: id } 
      });
      
      progress = up ? {
        completedSections: JSON.parse(up.completedSections || '[]'),
        percent: up.percent || 0,
        xp: up.xp || 0
      } : { 
        completedSections: [], 
        percent: 0, 
        xp: 0 
      };
    }

    res.json({
      status: true,
      data: {
        materi: {
          id: materi.id,
          title: materi.title,
          description: materi.description
        },
        sections,
        videoSection,
        miniLesson: miniSection ? {
          type: miniSection.type,
          content: miniSection.content,
          title: miniSection.title
        } : null,
        clues: materi.Clues || [],
        progress
      }
    });

  } catch (err) {
    console.error('Get Materi Detail Error:', err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// ================= COMPLETE STEP (GAMIFIKASI LENGKAP) =================
exports.completeStep = async (req, res) => {
  try {
    const userId = req.user?.id;
    const materiId = parseInt(req.params.id);
    const { step } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        status: false, 
        message: "Unauthorized - login dulu" 
      });
    }

    if (!STEPS.includes(step)) {
      return res.status(400).json({ 
        status: false, 
        message: "Invalid step" 
      });
    }

    let progress = await UserMateriProgress.findOne({
      where: { userId, materiId }
    });

    if (!progress) {
      progress = await UserMateriProgress.create({
        userId,
        materiId,
        completedSections: JSON.stringify([]),
        percent: 0,
        xp: 0
      });
    }

    let completedSteps = JSON.parse(progress.completedSections || '[]');
    
    // Clean invalid steps
    completedSteps = completedSteps.filter(s => STEPS.includes(s));

    // Validasi sequence (tidak bisa lompat)
    if (step === "join_discussion" && !completedSteps.includes("watch_video")) {
      return res.status(400).json({ 
        status: false, 
        message: "Harus nonton video dulu!" 
      });
    }

    let currentXp = progress.xp || 0;
    let xpGain = 0;

    // Tambah step + XP jika belum ada
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
      xpGain = XP_MAP[step] || 0;
      currentXp += xpGain;
    }

    const percent = Math.min(
      Math.round((completedSteps.length / STEPS.length) * 100), 
      100
    );

    // Update UserMateriProgress
    await progress.update({
      completedSections: JSON.stringify(completedSteps),
      percent,
      xp: currentXp
    });

    // 🆕 Update User global XP
    const user = await User.findByPk(userId);
    if (user && xpGain > 0) {
      await user.update({
        xp: user.xp + xpGain
      });
    }

    res.json({
      status: true,
      message: xpGain > 0 ? `+${xpGain} XP!` : "Sudah completed",
      percent,
      completedSteps,
      xp: currentXp,
      xpGain
    });

  } catch (err) {
    console.error("Complete Step Error:", err);
    res.status(500).json({ 
      status: false, 
      message: "Server error" 
    });
  }
};

// ================= UPDATE PROGRESS (Legacy - untuk sections) =================
exports.updateProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const materiId = parseInt(req.params.id);
    const { completedSections } = req.body;
    
    if (!Array.isArray(completedSections)) {
      return res.status(400).json({ 
        status: false, 
        message: "completedSections harus array" 
      });
    }

    const totalSections = await MateriSection.count({ where: { materiId } });
    const percent = totalSections === 0 ? 0 : Math.round((completedSections.length / totalSections) * 100);

    const [up, created] = await UserMateriProgress.findOrCreate({
      where: { userId, materiId },
      defaults: { 
        completedSections: JSON.stringify(completedSections), 
        percent, 
        xp: 0 
      }
    });

    if (!created) {
      await up.update({ 
        completedSections: JSON.stringify(completedSections), 
        percent 
      });
    }

    res.json({ status: true, percent });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// ================= ORIENTASI SPECIALS =================
exports.getOrientasi = async (req, res) => {
  try {
    const step = await MateriSection.findOne({ 
      where: { materiId: req.params.id, type: 'video', title: 'Orientasi' } 
    });
    res.json({ status: true, data: step || {} });
  } catch (err) {
    console.error('Get Orientasi Error:', err);
    res.status(500).json({ status: false, message: 'Failed to get orientasi' });
  }
};

exports.putOrientasi = async (req, res) => {
  try {
    const { videoUrl } = req.body;
    if (!videoUrl?.trim()) {
      return res.status(400).json({ status: false, message: 'Video URL tidak boleh kosong' });
    }
    
    let step = await MateriSection.findOne({ 
      where: { materiId: req.params.id, type: 'video', title: 'Orientasi' } 
    });
    
    if (step) {
      await step.update({ content: videoUrl.trim() });
    } else {
      step = await MateriSection.create({ 
        materiId: req.params.id, 
        title: "Orientasi", 
        type: "video", 
        content: videoUrl.trim(), 
        order: 0 
      });
    }
    res.json({ status: true, data: step });
  } catch (err) {
    console.error('Put Orientasi Error:', err);
    res.status(500).json({ status: false, message: 'Failed to update orientasi' });
  }
};

// ================= SECTIONS CRUD =================
exports.listSections = async (req, res) => {
  try {
    const list = await MateriSection.findAll({ 
      where: { materiId: req.params.id }, 
      order: [["order", "ASC"]] 
    });
    res.json({ status: true, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

exports.createSection = async (req, res) => {
  try {
    const body = req.body;
    const s = await MateriSection.create({ ...body, materiId: req.params.id });
    res.json({ status: true, data: s });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

exports.updateSection = async (req, res) => {
  try {
    const s = await MateriSection.findByPk(req.params.sectionId);
    if (!s) return res.status(404).json({ status: false, message: "Not found" });
    await s.update(req.body);
    res.json({ status: true, data: s });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

exports.deleteSection = async (req, res) => {
  try {
    const s = await MateriSection.findByPk(req.params.sectionId);
    if (!s) return res.status(404).json({ status: false, message: "Not found" });
    await s.destroy();
    res.json({ status: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

// ================= CLUES CRUD =================
exports.listClues = async (req, res) => {
  try {
    const list = await Clue.findAll({ where: { materiId: req.params.id }, order: [["id", "ASC"]] });
    res.json({ status: true, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

exports.createClue = async (req, res) => {
  try {
    const count = await Clue.count({ where: { materiId: req.params.id } });
    if (count >= 3) {
      return res.status(400).json({ status: false, message: "Maximum clues reached" });
    }

    const c = await Clue.create({ 
      clueText: req.body.clueText,                
      cost: req.body.cost,
      materiId: req.params.id
    });
    res.json({ status: true, data: c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

exports.updateClue = async (req, res) => {
  try {
    const c = await Clue.findByPk(req.params.clueId);
    if (!c) return res.status(404).json({ status: false, message: "Not found" });
    await c.update(req.body);
    res.json({ status: true, data: c });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

exports.deleteClue = async (req, res) => {
  try {
    const c = await Clue.findByPk(req.params.clueId);
    if (!c) return res.status(404).json({ status: false, message: "Not found" });
    await c.destroy();
    res.json({ status: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

// ================= JAWABAN MATERI =================
exports.getMateriAnswerById = async (req, res) => {
  try {
    const materiId = req.params.id;
    const answer = await MateriAnswer.findOne({ where: { materiId } });
    res.json({ status: true, data: answer || {} });
  } catch (err) {
    console.error('Get Materi Answer Error:', err);
    res.status(500).json({ status: false, message: 'Failed to get answer' });
  }
};

exports.saveMateriAnswer = async (req, res) => {
  try {
    const materiId = req.params.id;
    const { pseudocode, flowchart } = req.body;

    let answer = await MateriAnswer.findOne({ where: { materiId } });

    if (answer) {
      await answer.update({ pseudocode, flowchart });
    } else {
      answer = await MateriAnswer.create({
        materiId,
        pseudocode,
        flowchart
      });
    }

    res.json({ status: true, data: answer });
  } catch (err) {
    console.error('Save Materi Answer Error:', err);
    res.status(500).json({ status: false, message: 'Failed to save answer' });
  }
};