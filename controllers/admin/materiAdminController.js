const { Materi, MateriSection, UserMateriProgress, Clue, DiscussionRoom, Upload, MateriAnswer } = require("../../models");
const fs = require("fs");
const path = require("path");

const STEPS = ["watch_video", "open_mini_lesson", "join_discussion", "submit_answer"];

const XP_MAP = {
  watch_video: 10,
  open_mini_lesson: 15,
  join_discussion: 20,
  submit_answer: 50
};

// materi
exports.listMateri = async (req,res) => {
  const list = await Materi.findAll({ order: [["order","ASC"]] });
  res.json(list);
};
exports.getMateri = async (req,res) => {
  const m = await Materi.findByPk(req.params.id);
  if(!m) return res.status(404).json({error:"Not found"});
  res.json(m);
};
exports.createMateri = async (req,res) => {
  const m = await Materi.create(req.body);
  res.json(m);
};
exports.updateMateri = async (req,res) => {
  const m = await Materi.findByPk(req.params.id);
  if(!m) return res.status(404).json({error:"Not found"});
  await m.update(req.body);
  res.json(m);
};
exports.deleteMateri = async (req,res) => {
  const m = await Materi.findByPk(req.params.id);
  if(!m) return res.status(404).json({error:"Not found"});
  await m.destroy();
  res.json({ success:true });
};

// === ORIENTASI ===
exports.getOrientasi = async (req, res) => {
  try {
    const step = await MateriSection.findOne({ 
      where: { materiId: req.params.id, type: 'video', title: 'Orientasi' } 
    });
    return res.json(step || {});
  } catch (err) {
    console.error('Get Orientasi Error:', err);
    res.status(500).json({ error: 'Failed to get orientasi' });
  }
};

exports.putOrientasi = async (req, res) => {
  try {
    const { videoUrl } = req.body;
    if (!videoUrl?.trim()) {
      return res.status(400).json({ error: 'Video URL tidak boleh kosong' });
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
    res.json(step);
  } catch (err) {
    console.error('Put Orientasi Error:', err);
    res.status(500).json({ error: 'Failed to update orientasi' });
  }
};

exports.uploadOrientasi = async (req, res) => {
  console.log("=== ORIENTASI UPLOAD DEBUG ===");
  console.log("req.file:", req.file);
  console.log("req.body:", req.body);
  
  if (!req.file) {
    return res.status(400).json({ 
      error: "Tidak ada file yang diupload", 
      debug: { hasFile: !!req.file, mimetype: req.file?.mimetype }
    });
  }

  try {
    // Generate full URL
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://powderblue-squirrel-795269.hostingersite.com'
      : 'http://localhost:5000';
    const url = `${baseUrl}/uploads/orientasi/${req.file.filename}`;
    
    console.log("Generated URL:", url);
    
    let step = await MateriSection.findOne({ 
      where: { materiId: req.params.id, type: 'video', title: 'Orientasi' } 
    });
    
    if (step) {
      // Hapus file lama jika ada
      if (step.content && step.content.includes('/uploads/orientasi/')) {
        const oldFileName = step.content.split('/uploads/orientasi/')[1];
        const oldFilePath = path.join(__dirname, '../../uploads/orientasi', oldFileName);
        if (fs.existsSync(oldFilePath)) {
          fs.unlinkSync(oldFilePath);
          console.log("Old file deleted:", oldFilePath);
        }
      }
      await step.update({ content: url });
    } else {
      step = await MateriSection.create({ 
        materiId: req.params.id, 
        title: "Orientasi", 
        type: "video", 
        content: url, 
        order: 0 
      });
    }
    
    console.log("✅ Upload success:", step.id);
    res.json(step);
  } catch (err) {
    console.error('Upload Orientasi Error:', err);
    // Cleanup file jika error
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload gagal: ' + err.message });
  }
};

exports.deleteOrientasi = async (req, res) => {
  try {
    let step = await MateriSection.findOne({ 
      where: { materiId: req.params.id, type: 'video', title: 'Orientasi' } 
    });
    
    if (!step) {
      return res.json({ success: true, message: 'Tidak ada orientasi' });
    }
    
    // Hapus file fisik jika ada
    if (step.content && step.content.includes('/uploads/orientasi/')) {
      const fileName = step.content.split('/uploads/orientasi/')[1];
      const filePath = path.join(__dirname, '../../uploads/orientasi', fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log("File deleted:", filePath);
      }
    }
    
    await step.destroy();
    res.json({ success: true });
  } catch (err) {
    console.error('Delete Orientasi Error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
};

// === SECTION IMAGE UPLOAD ===
// 🔥 FIXED: Upload Section Image (ganti yang lama)
exports.uploadSectionImage = async (req, res) => {
  console.log("=== SECTION IMAGE UPLOAD ===");
  console.log("req.file:", req.file);
  
  if (!req.file) {
    return res.status(400).json({ error: "No image file uploaded" });
  }

  try {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? 'https://powderblue-squirrel-795269.hostingersite.com'
      : 'http://localhost:5000';
    const url = `${baseUrl}/uploads/sections/${req.file.filename}`;
    
    // Buat folder sections jika belum ada
    const uploadDir = path.join(__dirname, '../../uploads/sections');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    console.log("✅ Generated URL:", url);
    res.json({ url });
  } catch (err) {
    console.error('Upload Section Image Error:', err);
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Upload failed' });
  }
};

// Sections
exports.listSections = async (req,res)=> {
  const list = await MateriSection.findAll({ where:{ materiId: req.params.id }, order:[["order","ASC"]] });
  res.json(list);
};
exports.createSection = async (req,res)=> {
  const body = req.body;
  const s = await MateriSection.create({ ...body, materiId: req.params.id });
  res.json(s);
};
exports.updateSection = async (req,res)=> {
  const s = await MateriSection.findByPk(req.params.sectionId);
  if(!s) return res.status(404).json({error:"Not found"});
  await s.update(req.body);
  res.json(s);
};
exports.deleteSection = async (req,res)=> {
  const s = await MateriSection.findByPk(req.params.sectionId);
  if(!s) return res.status(404).json({error:"Not found"});
  await s.destroy();
  res.json({ success:true });
};

// Clues
exports.listClues = async (req,res)=> {
  const list = await Clue.findAll({ where:{ materiId: req.params.id }, order:[["id","ASC"]] });
  res.json(list);
};
exports.createClue = async (req,res)=> {
  console.log("BODY CREATE CLUE:", req.body);   

  const count = await Clue.count({ where:{ materiId: req.params.id }});
  if(count >= 3) return res.status(400).json({error:"Maximum clues reached"});

  const c = await Clue.create({ 
    clueText: req.body.clueText,                
    cost: req.body.cost,
    materiId: req.params.id
  });

  res.json(c);
};

exports.updateClue = async (req,res)=> {
  const c = await Clue.findByPk(req.params.clueId);
  if(!c) return res.status(404).json({error:"Not found"});
  await c.update(req.body);
  res.json(c);
};
exports.deleteClue = async (req,res)=> {
  const c = await Clue.findByPk(req.params.clueId);
  if(!c) return res.status(404).json({error:"Not found"});
  await c.destroy();
  res.json({ success:true });
};

// Rooms
exports.listRooms = async (req,res)=> {
  const list = await DiscussionRoom.findAll({ where:{ materiId: req.params.id }});
  res.json(list);
};
exports.createRoom = async (req, res) => {
  try {
    const { title, capacity } = req.body;
    const materiId = req.params.id;

    if (!title) return res.status(400).json({ message: "title wajib diisi" });
    if (!capacity) return res.status(400).json({ message: "capacity wajib diisi" });

    const room = await DiscussionRoom.create({
      materiId,
      title,
      capacity,
      isClosed: false
    });

    res.json(room);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Gagal membuat room" });
  }
};

exports.updateRoom = async (req,res)=> {
  const r = await DiscussionRoom.findByPk(req.params.roomId);
  if(!r) return res.status(404).json({error:"Not found"});
  await r.update(req.body);
  res.json(r);
};
exports.deleteRoom = async (req,res)=> {
  const r = await DiscussionRoom.findByPk(req.params.roomId);
  if(!r) return res.status(404).json({error:"Not found"});
  await r.destroy();
  res.json({ success:true });
};

// Uploads
exports.listUploads = async (req,res)=> {
  const list = await Upload.findAll({ where:{ materiId: req.params.id }});
  res.json(list);
};
exports.uploadFile = async (req,res)=> {
  if(!req.file) return res.status(400).json({error:"No file"});
  const url = `/uploads/${req.file.filename}`;
  const u = await Upload.create({ userId: req.user?.id || null, materiId: req.params.id, filePath: url });
  res.json(u);
};
exports.deleteUpload = async (req,res)=> {
  const u = await Upload.findByPk(req.params.uploadId);
  if(!u) return res.status(404).json({error:"Not found"});
  await u.destroy();
  res.json({ success:true });
};

// GET Jawaban materi berdasarkan materiId
exports.getMateriAnswerById = async (req, res) => {
  try {
    const materiId = req.params.id;
    const answer = await MateriAnswer.findOne({
      where: { materiId }
    });
    res.json(answer || {});
  } catch (err) {
    console.error('Get Materi Answer Error:', err);
    res.status(500).json({ error: 'Failed to get answer' });
  }
};

// POST/PUT Jawaban materi
exports.saveMateriAnswer = async (req, res) => {
  try {
    const materiId = req.params.id;
    const { pseudocode, flowchart } = req.body;

    let answer = await MateriAnswer.findOne({ where: { materiId } });

    if (answer) {
      // Update existing
      await answer.update({ pseudocode, flowchart });
    } else {
      // Create new
      answer = await MateriAnswer.create({
        materiId,
        pseudocode,
        flowchart
      });
    }

    res.json(answer);
  } catch (err) {
    console.error('Save Materi Answer Error:', err);
    res.status(500).json({ error: 'Failed to save answer' });
  }
};

// ================= 🎮 COMPLETE STEP (GAMIFIKASI) =================
exports.completeStep = async (req, res) => {
  try {
    const userId = req.user?.id;
    const materiId = parseInt(req.params.id);
    const { step } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!STEPS.includes(step)) {
      return res.status(400).json({ error: "Invalid step" });
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

    let completedSteps = JSON.parse(progress.completedSections);

    // bersihin data
    completedSteps = completedSteps.filter(s => STEPS.includes(s));

    let xp = progress.xp || 0;

    // 🔒 VALIDASI (tidak bisa lompat step)
    if (step === "join_discussion" && !completedSteps.includes("watch_video")) {
      return res.status(400).json({
        error: "Harus nonton video dulu"
      });
    }

    // 🆕 tambah step + XP
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
      xp += XP_MAP[step] || 0;
    }

    const percentRaw = Math.round(
      (completedSteps.length / STEPS.length) * 100
    );

    const percent = Math.min(percentRaw, 100);

    await progress.update({
      completedSections: JSON.stringify(completedSteps),
      percent,
      xp
    });

    res.json({
      success: true,
      percent,
      completedSteps,
      xp
    });

  } catch (err) {
    console.error("Complete Step Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};