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

// 🆙 FIXED GET DETAIL MATERI - XP & PROGRESS AMAN
exports.getMateriDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.id;

    console.log(`🔍 Get materi ${id} for user ${userId || 'guest'}`);

    // 1. Get materi dasar
    const materi = await Materi.findByPk(id);
    if (!materi) {
      return res.status(404).json({ 
        status: false, 
        message: "Materi tidak ditemukan" 
      });
    }

    // 2. Get sections
    const sections = await MateriSection.findAll({
      where: { materiId: id },
      order: [["order", "ASC"]]
    });

    // 3. Get clues
    const clues = await Clue.findAll({
      where: { materiId: id },
      order: [["id", "ASC"]]
    });

    // 4. Filter sections
    const videoSection = sections.find(s => s.type === "video" && s.content);
    const miniSection = sections.find(s => s.type === "mini");

    // 🆙 FIXED PROGRESS & USER GLOBAL XP
    let progress = { 
      completedSections: [], 
      percent: 0, 
      xp: 0,
      totalUserXP: 0 
    };
    
    if (userId) {
      // Get USER global XP
      const user = await User.findByPk(userId);
      const userGlobalXP = user?.xp || 0;

      // Get MATERI progress
      const up = await UserMateriProgress.findOne({ 
        where: { userId, materiId: id } 
      });
      
      if (up) {
        try {
          const completedSections = JSON.parse(up.completedSections || '[]');
          progress = {
            completedSections: Array.isArray(completedSections) ? completedSections : [],
            percent: up.percent || 0,
            xp: up.xp || 0,
            totalUserXP: userGlobalXP  // 🆙 USER TOTAL XP
          };
        } catch (parseErr) {
          console.error('Parse progress error:', parseErr);
          progress = { completedSections: [], percent: 0, xp: 0, totalUserXP: userGlobalXP };
        }
      } else {
        progress.totalUserXP = userGlobalXP;
      }
    }

    // 🆙 DEBUG LOG
    console.log('📊 Progress response:', {
      userId,
      completedSections: progress.completedSections,
      materiXP: progress.xp,
      totalUserXP: progress.totalUserXP
    });

    res.json({
      status: true,
      data: {
        materi: {
          id: materi.id,
          title: materi.title,
          description: materi.description || ""
        },
        sections: sections.map(s => ({
          id: s.id,
          type: s.type,
          content: s.content,
          title: s.title,
          order: s.order
        })),
        videoSection: videoSection ? {
          id: videoSection.id,
          type: videoSection.type,
          content: videoSection.content,
          title: videoSection.title
        } : null,
        miniLesson: miniSection ? {
          type: miniSection.type,
          content: miniSection.content,
          title: miniSection.title
        } : null,
        clues,
        progress  // 🆙 FULL PROGRESS WITH totalUserXP
      }
    });

  } catch (err) {
    console.error('🚨 Get Materi Detail FULL ERROR:', err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// 🆙 FIXED COMPLETE STEP - NO DOUBLE, XP CORRECT
exports.completeStep = async (req, res) => {
  try {
    const userId = req.user.id;
    const materiId = parseInt(req.params.id);
    const { step } = req.body;

    console.log(`🎮 Complete step: ${step} | User: ${userId} | Materi: ${materiId}`);

    // 🆙 VALIDATE STEP
    const validSteps = ["watch_video", "open_mini_lesson"];
    if (!validSteps.includes(step)) {
      return res.status(400).json({ status: false, message: "Invalid step" });
    }

    // 🆙 GET OR CREATE PROGRESS
    let progress = await UserMateriProgress.findOne({ where: { userId, materiId } });
    if (!progress) {
      progress = await UserMateriProgress.create({
        userId, materiId, 
        completedSections: JSON.stringify([]), 
        percent: 0, 
        xp: 0
      });
    }

    // 🆙 PARSE COMPLETED SECTIONS
    let completedSections = [];
    try {
      completedSections = JSON.parse(progress.completedSections || '[]');
      completedSections = Array.isArray(completedSections) ? completedSections : [];
    } catch (e) {
      completedSections = [];
    }

    // 🆙 CHECK ALREADY COMPLETED
    if (completedSections.includes(step)) {
      console.log(`⚠️ ${step} already completed`);
      const user = await User.findByPk(userId);
      return res.json({
        status: true,
        xpGain: 0,
        totalXP: user.xp || 0,
        materiXP: progress.xp || 0,
        percent: progress.percent || 0,
        completedSteps: completedSections
      });
    }

    // 🆙 CALCULATE REWARDS
    const xpGain = XP_MAP[step] || 0;
    completedSections.push(step);
    const newMateriXP = (progress.xp || 0) + xpGain;
    const percent = Math.min(100, Math.round((completedSections.length / validSteps.length) * 100));

    // 🆙 UPDATE MATERI PROGRESS
    await progress.update({
      completedSections: JSON.stringify(completedSections),
      percent,
      xp: newMateriXP
    });

    // 🆙 UPDATE USER GLOBAL XP
    const user = await User.findByPk(userId);
    const newTotalXP = (user.xp || 0) + xpGain;
    await user.update({ xp: newTotalXP });

    console.log(`✅ ${step} COMPLETED! +${xpGain}XP | MateriXP: ${newMateriXP} | TotalXP: ${newTotalXP}`);

    res.json({
      status: true,
      xpGain,
      totalXP: newTotalXP,        // 🆙 USER GLOBAL XP
      materiXP: newMateriXP,      // 🆙 MATERI XP
      percent,
      completedSteps: completedSections
    });

  } catch (err) {
    console.error('🚨 Complete Step ERROR:', err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// ================= UPDATE PROGRESS (Legacy) =================
exports.updateProgress = async (req, res) => {
  try {
    const userId = req.user.id;
    const materiId = parseInt(req.params.id);
    const { completedSections } = req.body;
    
    if (!Array.isArray(completedSections)) {
      return res.status(400).json({ status: false, message: "completedSections harus array" });
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