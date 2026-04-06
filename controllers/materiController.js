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

// 🆕 QUEST SYSTEM - HANYA 2 STEPS
const QUEST_STEPS = ["watch_video", "open_mini_lesson"];
const XP_REWARDS = {
  watch_video: 20,
  open_mini_lesson: 25
};

// ================= MATERI CRUD =================
exports.listMateri = async (req, res) => {
  try {
    const materiList = await Materi.findAll({ 
      order: [["order", "ASC"]] 
    });

    let progressMap = {};
    if (req.user?.id) {
      const progresses = await UserMateriProgress.findAll({
        where: { userId: req.user.id }
      });
      
      progresses.forEach(p => {
        progressMap[p.materiId] = {
          percent: p.percent || 0,
          xp: p.xp || 0,
          completedSteps: JSON.parse(p.completedSections || '[]'),
          totalXP: p.totalXP || 0
        };
      });
    }

    const data = materiList.map(m => ({
      id: m.id,
      title: m.title,
      description: m.description,
      progress: progressMap[m.id]?.percent || 0,
      xp: progressMap[m.id]?.xp || 0,
      completedSteps: progressMap[m.id]?.completedSteps || []
    }));

    res.json({ status: true, data });
  } catch (err) {
    console.error('List Materi Error:', err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// ================= GET DETAIL MATERI (XP AWAL FIX) =================
exports.getMateriDetail = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.id;

    const materi = await Materi.findByPk(id);
    if (!materi) {
      return res.status(404).json({ status: false, message: "Materi tidak ditemukan" });
    }

    const sections = await MateriSection.findAll({
      where: { materiId: id },
      order: [["order", "ASC"]]
    });

    const videoSection = sections.find(s => s.type === "video" && s.content);
    const miniLesson = sections.find(s => s.type === "mini");

    let progress = { completedSections: [], materiXP: 0, totalXP: 0, userXP: 0 };

    if (userId) {
      const userProgress = await UserMateriProgress.findOne({ where: { userId, materiId: id } });
      const user = await User.findByPk(userId);
      
      progress = {
        completedSections: userProgress ? JSON.parse(userProgress.completedSections || '[]') : [],
        materiXP: userProgress?.xp || 0,
        totalXP: userProgress?.totalXP || 0,
        userXP: user?.xp || 0 // ✅ XP AWAL USER
      };
    }

    res.json({
      status: true,
      data: {
        materi: { id: materi.id, title: materi.title, description: materi.description || "" },
        videoSection: videoSection || null,
        miniLesson: miniLesson || null,
        sections,
        progress
      }
    });
  } catch (err) {
    console.error('GetMateriDetail ERROR:', err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// 🔥 COMPLETE QUEST (2 STEPS + GLOBAL XP UPDATE)
exports.completeStep = async (req, res) => {
  try {
    const userId = req.user.id;
    const materiId = parseInt(req.params.id);
    const { step } = req.body;

    if (!QUEST_STEPS.includes(step)) {
      return res.status(400).json({ status: false, message: `Step salah: ${step}` });
    }

    let userProgress = await UserMateriProgress.findOne({ where: { userId, materiId } });

    if (!userProgress) {
      userProgress = await UserMateriProgress.create({
        userId, materiId, completedSections: JSON.stringify([]), xp: 0, totalXP: 0, percent: 0
      });
    }

    let completedSteps = JSON.parse(userProgress.completedSections || "[]");
    if (completedSteps.includes(step)) {
      return res.json({ status: true, message: 'Sudah selesai', xpGain: 0, data: { 
        completedSteps, materiXP: userProgress.xp, totalXP: userProgress.totalXP,
        userXP: (await User.findByPk(userId))?.xp || 0 
      } });
    }

    const xpGain = XP_REWARDS[step];
    completedSteps.push(step);
    const newMateriXP = (userProgress.xp || 0) + xpGain;
    const newTotalXP = (userProgress.totalXP || 0) + xpGain;
    const percent = Math.round((completedSteps.length / QUEST_STEPS.length) * 100);

    await userProgress.update({
      completedSections: JSON.stringify(completedSteps),
      xp: newMateriXP,
      totalXP: newTotalXP,
      percent
    });

    // Update user XP
    const user = await User.findByPk(userId);
    const finalUserXP = (user.xp || 0) + xpGain;
    await user.update({ xp: finalUserXP });

    console.log(`✅ ${userId} complete ${step}: +${xpGain}XP, total: ${finalUserXP}`);

    res.json({
      status: true,
      data: {
        xpGain,
        completedSteps,
        materiXP: newMateriXP,
        totalXP: newTotalXP,
        userXP: finalUserXP, // ✅ XP TERBARU
        percent
      }
    });
  } catch (err) {
    console.error('CompleteStep ERROR:', err);
    res.status(500).json({ status: false, message: "Quest gagal" });
  }
};

// ================= MATERI CRUD LAINNYA =================
exports.getMateri = async (req, res) => {
  try {
    const m = await Materi.findByPk(req.params.id);
    if (!m) return res.status(404).json({ status: false, message: "Not found" });
    res.json({ status: true, data: m });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
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

// ================= LEGACY PROGRESS UPDATE =================
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

    const [userProgress, created] = await UserMateriProgress.findOrCreate({
      where: { userId, materiId },
      defaults: { 
        completedSections: JSON.stringify(completedSections), 
        percent, 
        xp: 0,
        totalXP: 0
      }
    });

    if (!created) {
      await userProgress.update({ 
        completedSections: JSON.stringify(completedSections), 
        percent 
      });
    }

    res.json({ 
      status: true, 
      percent, 
      completedSections 
    });
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
    const list = await Clue.findAll({ 
      where: { materiId: req.params.id }, 
      order: [["id", "ASC"]] 
    });
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