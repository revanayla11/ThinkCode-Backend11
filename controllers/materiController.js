const User = require("../models/User");
const Materi = require("../models/Materi");
const MateriSection = require("../models/MateriSection");
const UserMateriProgress = require("../models/UserMateriProgress");
const UserProgress = require("../models/UserProgress");
const Clue = require("../models/Clue");
const DiscussionRoom = require("../models/DiscussionRoom");
const Upload = require("../models/Upload");
const MateriAnswer = require("../models/MateriAnswer");
const fs = require("fs");
const path = require("path");

// 🔥 2 SISTEM TERPISAH
const QUEST_STEPS = ["watch_video", "open_mini_lesson"];
const QUEST_XP_REWARDS = {
  watch_video: 15,
  open_mini_lesson: 15
};

const STEPS = ["watch_video", "open_mini_lesson", "join_discussion", "submit_answer"];

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
        const allSteps = JSON.parse(p.questSteps || '[]');
        const validSteps = allSteps.filter(s => STEPS.includes(s));
        
        // 🔥 PROGRESS dari 4 STEPS (0-100%)
        const totalSteps = STEPS.length;
        const completedStepCount = validSteps.length;
        const percent = Math.min(Math.round((completedStepCount / totalSteps) * 100), 100);
        
        progressMap[p.materiId] = {
          percent,
          xp: p.xp || 0,
          completedSteps: validSteps,
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

// ================= GET DETAIL MATERI =================
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

    const videoSection = sections?.find(s => s.type === "video" && s.content) || null;
    const miniLesson = sections?.find(s => s.type === "mini") || null;

    const safeParse = (data) => {
      try {
        return JSON.parse(data);
      } catch {
        return [];
      }
    };

    let progress = {
      completedSteps: [],
      percent: 0,
      materiXP: 0,
      userXP: 0
    };

    let userProgress = null;
    let user = null;

    if (userId) {
      userProgress = await UserMateriProgress.findOne({
        where: { userId, materiId: id }
      });
      user = await User.findByPk(userId);

      const allSteps = safeParse(userProgress?.questSteps);
      const validSteps = allSteps.filter(s => STEPS.includes(s));
      
      // 🔥 PROGRESS dari 4 STEPS
      const totalSteps = STEPS.length;
      const completedStepCount = validSteps.length;
      const percent = Math.min(Math.round((completedStepCount / totalSteps) * 100), 100);

      progress = {
        completedSteps: validSteps,
        percent,
        materiXP: userProgress?.xp || 0,
        userXP: user?.xp || 0
      };
    }

    res.json({
      status: true,
      data: {
        materi,
        videoSection,
        miniLesson,
        sections,
        progress
      }
    });

  } catch (err) {
    console.error("ERROR getMateriDetail:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// ================= COMPLETE STEP (MASTER ENDPOINT) =================
exports.completeStep = async (req, res) => {
  try {
    const userId = req.user.id;
    const materiId = parseInt(req.params.id);
    const { step } = req.body;

    console.log('✅ Valid STEPS:', STEPS)

    // ✅ Validasi semua 4 STEPS
    if (!STEPS.includes(step)) {
      return res.status(400).json({ status: false, message: "Invalid step" });
    }

    let progress = await UserMateriProgress.findOne({
      where: { userId, materiId }
    });

    if (!progress) {
      progress = await UserMateriProgress.create({
        userId,
        materiId,
        completedSections: JSON.stringify([]),
        questSteps: JSON.stringify([]),
        percent: 0,
        xp: 0
      });
    }

    let allSteps = safeParse(progress.questSteps);
    allSteps = allSteps.filter(s => STEPS.includes(s)); // bersihkan data aneh

    let xpGain = 0;
    
    // 🔥 XP HANYA untuk QUEST_STEPS (2 steps)
    if (!allSteps.includes(step) && QUEST_STEPS.includes(step)) {
      xpGain = QUEST_XP_REWARDS[step] || 0;
    }
    // Steps lain (join_discussion, submit_answer) → NO XP tapi masuk DB
    
    if (!allSteps.includes(step)) {
      allSteps.push(step);
    }

    // 🔥 UPDATE PERCENT dari 4 STEPS (max 100%)
    const totalSteps = STEPS.length;
    const completedStepCount = allSteps.length;
    const newPercent = Math.min(Math.round((completedStepCount / totalSteps) * 100), 100);

    await progress.update({
      questSteps: JSON.stringify(allSteps),
      percent: newPercent
    });

    const user = await User.findByPk(userId);
    let newTotalXP = user.xp;

    if (xpGain > 0) {
      newTotalXP += xpGain;
      await user.update({ xp: newTotalXP });
    }

    res.json({
      status: true,
      step,
      xpGain,
      totalXP: newTotalXP,
      completedSteps: allSteps,
      percent: newPercent,
      progress: newPercent
    });

  } catch (err) {
    console.error('Complete Step Error:', err);
    res.status(500).json({ status: false, message: "Server error" });
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
        questSteps: JSON.stringify([]),
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
    const userId = req.user.id;
    const { pseudocode, flowchart } = req.body;

    // 🔥 AUTO COMPLETE submit_answer step
    await exports.completeStep({ user: { id: userId }, params: { id: materiId }, body: { step: "submit_answer" } }, res, true);

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

// 🔥 HELPER FUNCTION
const safeParse = (data) => {
  try {
    return JSON.parse(data || '[]');
  } catch {
    return [];
  }
};