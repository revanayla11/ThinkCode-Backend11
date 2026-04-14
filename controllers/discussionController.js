const sequelize = require('../config/db');
const DiscussionMessage = require("../models/DiscussionMessage");
const DiscussionRoom = require("../models/DiscussionRoom");
const User = require("../models/User");
const MateriSection = require("../models/MateriSection");
const Clue = require("../models/Clue");
const DiscussionClueLog = require("../models/DiscussionClueLog");
const UserMateriProgress = require("../models/UserMateriProgress");
const RoomMember = require("../models/RoomMember");
const RoomTaskProgress = require("../models/RoomTaskProgress");
const Workspace = require("../models/Workspace");
const WorkspaceAttempt = require("../models/WorkspaceAttempt");
const MateriAnswer = require("../models/MateriAnswer");

exports.syncUserXp = async (userId, materiId, transaction = null) => {
  const user = await User.findByPk(userId, { attributes: ['xp'], transaction });
  if (!user) return;

  let progress = await UserMateriProgress.findOne({
    where: { userId, materiId },
    transaction,
  });

  if (progress) {
    await progress.update({ xp: user.xp }, { transaction });
  } else {
    progress = await UserMateriProgress.create({
      userId,
      materiId,
      xp: user.xp,
      completedSections: '[]',
      percent: 0,
    }, { transaction });
  }
  return progress;
};

exports.getRoomPerformance = async (req, res) => {
  try {
    const { roomId } = req.params;

    // 🔥 CLUES
    const usedClues = await DiscussionClueLog.count({ where: { roomId } });

    // 🔥 ATTEMPTS - TERpisah pseudocode & flowchart
    const pseudoAttempts = await WorkspaceAttempt.count({ where: { roomId, type: "pseudocode" } });
    const flowchartAttempts = await WorkspaceAttempt.count({ where: { roomId, type: "flowchart" } });
    const totalAttempts = pseudoAttempts + flowchartAttempts;

    // 🔥 TASKS
    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    const allDone = tasks.length === 5 && tasks.every(t => t.done);

    // 🔥 SCORING - START 100%
    let score = 100;
    
    // Penalty 1: Clue (-10% per clue, max 3)
    score -= Math.min(usedClues * 10, 30);
    
    // Penalty 2: Attempts (-5% mulai attempt 6+)
    const attemptsAbove5 = Math.max(0, totalAttempts - 5);
    score -= attemptsAbove5 * 5;
    
    // Bonus: All tasks done (+10%)
    if (allDone) score += 10;
    
    // Clamp 0-100
    score = Math.max(0, Math.min(100, score));

    console.log(`📊 Performance room ${roomId}:`, {
      usedClues,
      pseudoAttempts,
      flowchartAttempts,
      totalAttempts,
      attemptsAbove5,
      allDone,
      score: Math.round(score)
    });

    res.json({
      score: Math.round(score),
      usedClues,
      attempts: {
        pseudocode: pseudoAttempts,
        flowchart: flowchartAttempts,
        total: totalAttempts,
        extra: attemptsAbove5
      },
      allDone,
      breakdown: {
        base: 100,
        cluePenalty: Math.min(usedClues * 10, 30),
        attemptPenalty: attemptsAbove5 * 5,
        taskBonus: allDone ? 10 : 0
      }
    });
  } catch (error) {
    console.error("Error getRoomPerformance:", error);
    res.status(500).json({ message: "Server error", score: 100 });
  }
};

/* ================= GET ROOMS ================= */
exports.getRooms = async (req, res) => {
  try {
    const materiId = req.params.materiId;
    if (!materiId) return res.status(400).json({ status: false, message: "materiId diperlukan" });

    const rooms = await DiscussionRoom.findAll({
      where: { materiId },
      attributes: ["id", "materiId", "title", "capacity", "isClosed"],
    });

    const roomsWithCurrent = await Promise.all(
      rooms.map(async (room) => {
        const current = await UserMateriProgress.count({ where: { roomId: room.id } });
        return { ...room.toJSON(), current };
      })
    );

    res.json({ status: true, data: roomsWithCurrent });
  } catch (err) {
    console.error("getRooms:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= GET ROOM CHAT ================= */
exports.getRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await DiscussionMessage.findAll({
      where: { roomId },
      include: [{ model: User, attributes: ["name"] }],
      order: [["createdAt", "ASC"]],
    });

    const formatted = messages.map(m => ({
      id: m.id,
      message: m.message,
      createdAt: m.createdAt,
      userId: m.userId,
      userName: m.User?.name || "System",
      userInitial: m.User ? (m.User.name.charAt(0) || "U").toUpperCase() : "💡",
      type: m.type || "message",
    }));

    res.json({ status: true, data: formatted });
  } catch (err) {
    console.error("getRoom:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= SEND MESSAGE ================= */
exports.sendMessage = async (req, res) => {
  try {
    const userId = req.user.id;
    const { roomId } = req.params;
    const { message } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ status: false, message: "Pesan kosong" });
    }

    const newMsg = await DiscussionMessage.create({
      roomId,
      userId,
      message,
      type: "message",
    });

    const user = await User.findByPk(userId);

    res.json({
      status: true,
      data: {
        id: newMsg.id,
        message: newMsg.message,
        createdAt: newMsg.createdAt,
        userId,
        userName: user.name,
        userInitial: user.name.charAt(0).toUpperCase(),
        type: "message",
      },
    });
  } catch (err) {
    console.error("sendMessage:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= MINI LESSON ================= */
exports.getMiniLesson = async (req, res) => {
  try {
    const { materiId } = req.params;
    const mini = await MateriSection.findOne({ where: { materiId, type: "mini" } });

    if (!mini) {
      return res.json({
        status: false,
        message: "Mini lesson tidak ditemukan",
      });
    }

    res.json({ status: true, data: mini });
  } catch (err) {
    console.error("getMiniLesson:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= GET CLUES ================= */
exports.getClues = async (req, res) => {
  try {
    const { materiId } = req.params;
    if (!materiId) {
      return res.status(400).json({ status: false, message: "materiId diperlukan" });
    }

    const clues = await Clue.findAll({
      where: { materiId },
      order: [["id", "ASC"]],
      attributes: ["id", "clueText", "cost"],
    });

    res.json({
      status: true,
      data: clues.map(c => ({
        id: c.id,
        content: c.clueText,
        cost: c.cost,
      })),
    });
  } catch (err) {
    console.error("getClues error:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= USE CLUE (GROUP XP) ================= */
exports.useClue = async (req, res) => {
  const transaction = await DiscussionMessage.sequelize.transaction();
  try {
    const { roomId: roomIdStr, clueId: clueIdStr } = req.params;
    const roomId = parseInt(roomIdStr, 10);
    const clueId = parseInt(clueIdStr, 10);
    const userId = req.user.id;

    if (isNaN(roomId) || roomId <= 0) return res.status(400).json({ message: "roomId tidak valid" });
    if (isNaN(clueId) || clueId <= 0) return res.status(400).json({ message: "clueId tidak valid" });

    const room = await DiscussionRoom.findByPk(roomId, { transaction });
    if (!room) return res.status(404).json({ message: "Room tidak ditemukan" });
    if (!room.materiId) return res.status(400).json({ message: "Room tidak punya materiId" });

    const clue = await Clue.findByPk(clueId, { transaction });
    if (!clue) return res.status(404).json({ message: "Clue tidak ditemukan" });

    const alreadyUsed = await DiscussionClueLog.findOne({ where: { roomId, clueId }, transaction });
    if (alreadyUsed) return res.status(400).json({ message: "Clue ini sudah digunakan di room ini" });

    const members = await UserMateriProgress.findAll({
      where: { materiId: room.materiId, roomId },
      transaction,
    });

    if (!members.length) {
      await transaction.rollback();
      return res.status(400).json({ message: "Tidak ada anggota di room" });
    }

    const cost = Number(clue.cost || 50);
    for (const member of members) {
      await exports.syncUserXp(member.userId, room.materiId, transaction);
      await member.reload({ transaction });

      if (member.xp < cost) {
        await transaction.rollback();
        return res.status(400).json({
  message: "XP tidak mencukupi untuk membuka clue",
  detail: {
    userId: member.userId,
    currentXp: member.xp,
    requiredXp: cost,
  },
  suggestion: "Kumpulkan XP terlebih dahulu dengan menyelesaikan Mini Game 🎮",
});
      }

      member.xp -= cost;
      await member.save({ transaction });

      await User.update(
        { xp: User.sequelize.literal(`xp - ${cost}`) },
        { where: { id: member.userId }, transaction }
      );
    }

    await DiscussionClueLog.create({ roomId, clueId, takenBy: userId }, { transaction });
    await DiscussionMessage.create({
      roomId,
      userId,
      type: "clue",
      message: `💡 Clue: ${clue.clueText}`,
    }, { transaction });

    await transaction.commit();
    return res.json({ status: true, message: "Clue berhasil dibuka" });
  } catch (err) {
    await transaction.rollback();
    console.error("useClue error:", err);
    return res.status(500).json({ message: "Terjadi kesalahan saat membuka clue" });
  }
};

/* ================= USED CLUE HISTORY ================= */
exports.getUsedClues = async (req, res) => {
  try {
    const { roomId } = req.params;
    const logs = await DiscussionClueLog.findAll({
      where: { roomId },
      include: [{ model: Clue }, { model: User, attributes: ["name"] }],
      order: [["createdAt", "ASC"]],
    });

    const formatted = logs.map(l => ({
      clueId: l.clueId,
      clueText: l.Clue.clueText,
      takenBy: l.User.name,
      createdAt: l.createdAt,
    }));

    res.json({ status: true, data: formatted });
  } catch (err) {
    console.error("getUsedClues:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= JOIN ROOM ================= */
exports.joinRoom = async (req, res) => {
  const transaction = await DiscussionMessage.sequelize.transaction();
  try {
    const userId = req.user.id;
    const { roomId } = req.params;

    const room = await DiscussionRoom.findByPk(roomId, { transaction });
    if (!room) {
      await transaction.rollback();
      return res.status(404).json({ status: false, message: "Room tidak ditemukan" });
    }

    const materiId = room.materiId;
    await exports.syncUserXp(userId, materiId, transaction);

    let progress = await UserMateriProgress.findOne({ where: { userId, materiId }, transaction });
    if (!progress) {
      progress = await UserMateriProgress.create({
        userId, materiId, xp: 0, completedSections: "[]", percent: 0, roomId: null
      }, { transaction });
    }

    if (progress.roomId && progress.roomId !== parseInt(roomId)) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: `Anda sudah join Room ${progress.roomId}`,
      });
    }

    await progress.update({ roomId: parseInt(roomId) }, { transaction });

    const alreadyMember = await RoomMember.findOne({ where: { room_id: roomId, user_id: userId }, transaction });
    if (!alreadyMember) {
      await RoomMember.create({ room_id: roomId, user_id: userId }, { transaction });
    }

    await transaction.commit();
    res.json({ status: true, message: "Berhasil join room", roomId });
  } catch (err) {
    await transaction.rollback();
    console.error("joinRoom:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= CAN USE CLUE (EACH MEMBER 50 XP) ================= */
exports.canUseClue = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await DiscussionRoom.findByPk(roomId);
    if (!room) return res.status(404).json({ status: false, message: "Room tidak ditemukan" });

    const members = await UserMateriProgress.findAll({
      where: { materiId: room.materiId, roomId }
    });

    const minXP = 50;
    const allHaveEnough = members.every(member => member.xp >= minXP);
    
    res.json({ 
      status: true, 
      canUse: allHaveEnough, 
      message: allHaveEnough ? "✅ Semua anggota punya cukup XP!" : "❌ Semua anggota butuh minimal 50 XP masing-masing",
      memberXP: members.map(m => ({ userId: m.userId, xp: m.xp, enough: m.xp >= minXP })),
      required: minXP
    });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= GET USER XP ================= */
exports.getUserXp = async (req, res) => {
  try {
    const { materiId } = req.params;
    const userId = req.user.id;
    const progress = await UserMateriProgress.findOne({ where: { userId, materiId }, attributes: ['xp'] });
    res.json({ status: true, xp: progress?.xp || 0 });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= NEW: GET WORKSPACE DATA (COMPLETE) ================= */
/* ================= GET WORKSPACE - JSON NATIVE ================= */
exports.getWorkspaceData = async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const workspace = await Workspace.findOne({ where: { roomId } });
    
    console.log(`🔍 JSON room ${roomId}:`, {
      exists: !!workspace,
      flowchart: workspace?.flowchart ? `${workspace.flowchart.conditions?.length || 0} conds` : 'null'
    });

    // 🔥 DIRECT ACCESS - NO PARSING!
    const flowchartObj = workspace?.flowchart || { 
      conditions: [], 
      elseInstruction: "", 
      showElse: false 
    };

    // 🔥 TASKS
    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    const taskMap = {};
    tasks.forEach(t => taskMap[t.taskId] = t.done);
    for (let i = 1; i <= 5; i++) taskMap[i] = !!taskMap[i];

    res.json({
      status: true,
      data: {
        pseudocode: workspace?.pseudocode || "",
        flowchart: flowchartObj,  // ✅ DIRECT JSON OBJECT
        tasks: taskMap
      }
    });

  } catch (err) {
    console.error("getWorkspaceData:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
/* ================= NEW: GET TASKS ================= */
exports.getTaskProgress = async (req, res) => {
  try {
    const { roomId } = req.params;
    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    const taskMap = {};
    tasks.forEach(t => { taskMap[t.taskId] = t.done; });
    for (let i = 1; i <= 5; i++) {
      if (!taskMap[i]) taskMap[i] = false;
    }
    res.json({ status: true, data: taskMap });
  } catch (err) {
    console.error("getTaskProgress:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// 🔥 TAMBAHKAN INI di ATAS savePseudocode (sebelum semua exports)
const fillBlanks = (template, answers) => {
  if (!template || !Array.isArray(answers)) {
    return template || "";
  }
  
  let filled = template;
  answers.forEach((answer, index) => {
    const placeholder = `___BLANK_${index}___`;
    filled = filled.replaceAll(placeholder, answer || `[BLANK ${index + 1}]`);
  });
  
  return filled.trim();
};

// Tambahkan ini untuk test fillBlanks
exports.testFillBlanks = async (req, res) => {
  try {
    const { template, answers } = req.body;
    const result = fillBlanks(template, answers);
    
    res.json({
      status: true,
      input: { template, answers },
      result,
      normalized: normalizePseudocode(result)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/* ================= SAVE PSEUDOCODE - KEEP FLOWCHART ✅ ================= */
exports.savePseudocode = async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    
    console.log('📥 savePseudocode INPUT:', {
      hasTemplate: !!req.body.template,
      hasAnswers: Array.isArray(req.body.answers),
      answersLength: req.body.answers?.length || 0,
      hasRaw: !!req.body.pseudocode
    });

    // 🔥 GET PSEUDOCODE - PRIORITY: template + answers
    let filledPseudocode = "";
    
    if (req.body.template && Array.isArray(req.body.answers)) {
      // ✅ FILL BLANKS MODE
      filledPseudocode = fillBlanks(req.body.template, req.body.answers);
      console.log('✅ BLANKS FILLED:', filledPseudocode.substring(0, 100));
    } else if (req.body.pseudocode) {
      // ✅ RAW PSEUDOCODE
      filledPseudocode = req.body.pseudocode.trim();
    } else {
      return res.status(400).json({ 
        error: "No pseudocode data! Kirim template+answers atau pseudocode" 
      });
    }

    if (!filledPseudocode.trim()) {
      return res.status(400).json({ error: "Pseudocode kosong!" });
    }

    const cleaned = filledPseudocode
      .replace(/\s+/g, ' ')
      .trim();

    console.log('📝 SAVING PSEUDO:', cleaned.substring(0, 100));

    // 🔥 UPSERT WORKSPACE - KEEP FLOWCHART!
    const [updatedCount] = await Workspace.upsert({
      roomId,
      pseudocode: cleaned,
      updatedAt: new Date()
    });

    // 🔥 TASK 3 DONE
    await RoomTaskProgress.upsert({ 
      roomId, 
      taskId: 3, 
      done: true 
    });
    
    // 🔥 ATTEMPT COUNT & CREATE LOG
    const attemptCount = await WorkspaceAttempt.count({ 
      where: { roomId, type: 'pseudocode' } 
    });
    
    await WorkspaceAttempt.create({
      roomId, 
      type: 'pseudocode', 
      attemptNumber: attemptCount + 1, 
      content: cleaned
    });

    console.log(`✅ PSEUDO #${attemptCount + 1} SAVED room ${roomId}`);

    res.json({
      status: true,
      message: `✅ Pseudocode tersimpan! (Attempt ${attemptCount + 1})`,
      preview: cleaned.substring(0, 80) + (cleaned.length > 80 ? '...' : ''),
      attempts: attemptCount + 1,
      length: cleaned.length
    });

  } catch (error) {
    console.error('💥 savePseudocode ERROR:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};
/* ================= SAVE FLOWCHART - KEEP PSEUDOCODE ✅ ================= */
exports.saveFlowchart = async (req, res) => {
  console.log('🚀 saveFlowchart START');
  
  try {
    const roomId = parseInt(req.params.roomId);
    const { flowchart } = req.body;

    console.log('📥 FLOWCHART:', JSON.stringify(flowchart, null, 2));

    // 🔥 GET EXISTING WORKSPACE - PENTING!
    const existing = await Workspace.findOne({ where: { roomId } });
    if (!existing) {
      return res.status(400).json({ error: 'Workspace not found' });
    }

    // 🔥 CLEAN FLOWCHART
    const cleanConditions = (flowchart.conditions || [])
      .map(c => ({
        condition: String(c.condition || '').trim(),
        yes: String(c.yes || '').trim(),
        no: String(c.no || '').trim()
      }))
      .filter(c => c.condition);

    const cleanFlow = {
      conditions: cleanConditions,
      elseInstruction: String(flowchart.elseInstruction || '').trim(),
      showElse: Boolean(flowchart.showElse)
    };

    if (cleanFlow.conditions.length === 0) {
      return res.status(400).json({ error: 'No valid conditions' });
    }

    // 🔥 UPDATE - KEEP PSEUDOCODE!
    await Workspace.update({
      flowchart: cleanFlow,  // ✅ JSON COLUMN - AUTO STRINGIFY
      updatedAt: new Date()
    }, { 
      where: { roomId } 
    });

    // 🔥 TASK 4
    await RoomTaskProgress.upsert({ 
      roomId, taskId: 4, done: true 
    });

    // 🔥 ATTEMPT
    const attemptCount = await WorkspaceAttempt.count({ 
      where: { roomId, type: 'flowchart' } 
    });
    
    await WorkspaceAttempt.create({
      roomId, type: 'flowchart', 
      attemptNumber: attemptCount + 1, 
      content: JSON.stringify(cleanFlow)  // Manual stringify untuk log
    });

    // 🔥 VERIFY SAVE
    const verify = await Workspace.findOne({ where: { roomId } });
    console.log('✅ DB AFTER SAVE:', {
      pseudocodeLength: verify.pseudocode?.length || 0,
      flowchartConditions: verify.flowchart?.conditions?.length || 0
    });

    res.json({
      status: true,
      message: `✅ Saved ${cleanFlow.conditions.length} conditions`,
      data: {
        pseudocodeKept: !!existing.pseudocode,
        conditions: cleanFlow.conditions.length,
        attempts: attemptCount + 1
      }
    });

  } catch (error) {
    console.error('💥 ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};
/* ================= GET WORKSPACE ================= */
exports.getWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params;
    const workspace = await Workspace.findOne({ where: { roomId } });
    res.json({ 
      status: true, 
      data: workspace || { 
        pseudocode: "", 
        flowchart: { conditions: [], elseInstruction: "" } 
      } 
    });
  } catch (err) {
    console.error("getWorkspace:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= UPDATE TASK ================= */
exports.updateTask = async (req, res) => {
  try {
    const { roomId, taskId } = req.params;
    const { done } = req.body;

    await RoomTaskProgress.upsert({
      roomId,
      taskId: parseInt(taskId),
      done: !!done,
    });

    res.json({ status: true, message: "Task updated" });
  } catch (err) {
    console.error("updateTask:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= CHECK ALL TASKS DONE ================= */
exports.checkAllTasksDone = async (req, res) => {
  try {
    const { roomId } = req.params;
    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    const allDone = tasks.length === 5 && tasks.every(t => t.done);
    res.json({ status: true, allDone });
  } catch (err) {
    console.error("checkAllTasksDone:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= SUBMISSION STATUS ================= */
exports.getSubmissionStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await DiscussionRoom.findByPk(roomId);
    res.json({ submitted: room?.isSubmitted || false });
  } catch (err) {
    console.error("getSubmissionStatus:", err);
    res.status(500).json({ submitted: false });
  }
};

/* ================= UPLOAD JAWABAN ================= */
exports.uploadJawaban = async (req, res) => {
  try {
    const { roomId } = req.params;

    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    const allDone = tasks.length === 5 && tasks.every(t => t.done);

    if (!allDone) {
      return res.status(400).json({
        status: false,
        message: "Selesaikan semua task sebelum upload jawaban."
      });
    }

    // Update room submitted status
    await DiscussionRoom.update({ isSubmitted: true }, { where: { id: roomId } });

    res.json({
      status: true,
      message: "Upload berhasil! Jawaban sudah disubmit."
    });
  } catch (err) {
    console.error("uploadJawaban:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= PSEUDOCODE TEMPLATE (DYNAMIC BY MATERI) ================= */
// ✅ UPDATE getPseudocodeTemplate
exports.getPseudocodeTemplate = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await DiscussionRoom.findByPk(roomId);
    
    // 🔥 CORRECT TEMPLATE SESUAI GURU
    const template = `DEKLARASI 
    ___BLANK_0___ : integer

ALGORITMA 
    read(___BLANK_1___)
    
    IF (___BLANK_2___) THEN 
        write("___BLANK_3___", ___BLANK_4___)
    ENDIF 

END`;

    const blanks = [
      { hint: "Nama variabel", expected: "angka" },
      { hint: "Variabel input", expected: "angka" },
      { hint: "Kondisi", expected: "angka > 0" },
      { hint: "Pesan awal", expected: "Angka " },
      { hint: "Variabel output", expected: "angka" }
    ];

    res.json({
      status: true,
      data: {
        template,
        blanks,
        expectedFull: `DEKLARASI 
    angka : integer

ALGORITMA 
    read(angka)
    
    IF (angka > 0) THEN 
        write("Angka ", angka, " adalah Positif")
    ENDIF 

END`,
        totalBlanks: 5
      }
    });
  } catch (error) {
    // Fallback juga update
    res.status(500).json({ 
      status: false,
      data: {
        template: `DEKLARASI 
    ___BLANK_0___ : integer

ALGORITMA 
    read(___BLANK_1___)
    
    IF (___BLANK_2___) THEN 
        write("___BLANK_3___", ___BLANK_4___)
    ENDIF 

END`,
        blanks: [
          { hint: "Nama variabel" },
          { hint: "Variabel input" },
          { hint: "Kondisi" },
          { hint: "Pesan awal" },
          { hint: "Variabel output" }
        ]
      }
    });
  }
};

// 🔥 HELPER FUNCTIONS - TAMBAH INI SEBELUM validateWorkspace
const getPseudoFeedback = (score) => {
  if (score >= 80) return "✅ Struktur lengkap & keyword tepat!";
  if (score >= 60) return "⚠️ Hampir benar, cek kondisi IF";
  if (score >= 40) return "📝 Tambah DEKLARASI & ALGORITMA";
  return "🚨 Mulai dari dasar: DEKLARASI → read → IF → write";
};

const getExpectedAnswer = (materiId) => {
  const templates = {
    1: `deklarasi angka : integer algoritma read(angka) if (angka > 0) then write("Angka ", angka, " adalah Positif") endif end`,
    2: `deklarasi nilai : integer algoritma read(nilai) if (nilai >= 70) then write("Status: Lulus") else write("Status: Tidak Lulus") endif end`,
    3: `deklarasi umur : integer algoritma read(umur) if (umur <= 12) then write("Kategori: Anak-anak") else if (umur <= 17) then write("Kategori: Remaja") else if (umur <= 59) then write("Kategori: Dewasa") else write("Kategori: Lansia") endif end`
  };
  return templates[materiId] || templates[1];
};

const normalize = (text) => {
  if (!text) return "";
  return text
    .replace(/___BLANK_\d+___/gi, '')
    .replace(/\$BLANK \d+\$/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

// Tambahkan di atas validateWorkspace
exports.validateWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params;
    const safeRoomId = parseInt(roomId);
    
    console.log(`🔍 [VALIDATE] Room ${safeRoomId}`);

    // 🔥 GET ROOM & WORKSPACE
    const [room, workspace] = await Promise.all([
      DiscussionRoom.findByPk(safeRoomId),
      Workspace.findOne({ where: { roomId: safeRoomId } })
    ]);

    if (!room) return res.status(404).json({ valid: false, score: 0, error: "Room not found" });
    if (!workspace) return res.json({ valid: false, score: 0, message: "Workspace kosong" });

    // 🔥 GET GURU JAWABAN dari DB
    const guruAnswer = await MateriAnswer.findOne({ 
      where: { materiId: room.materiId } 
    });

    console.log(`📚 GURU JAWABAN:`, {
      pseudocode: guruAnswer?.pseudocode?.substring(0, 50),
      flowchartConditions: guruAnswer?.flowchart?.conditions?.length || 0
    });

    // 🔥 PSEUDOCODE VALIDATION - EXACT MATCH dengan NORMALIZE
    let pseudoScore = 0;
    let pseudoDetails = { match: false, score: 0, feedback: "❌ Pseudocode kosong" };
    
    if (workspace.pseudocode?.trim() && guruAnswer?.pseudocode?.trim()) {
      const userPseudo = normalizePseudocode(workspace.pseudocode);
      const guruPseudo = normalizePseudocode(guruAnswer.pseudocode);
      
      console.log(`🔍 PSEUDO COMPARE:`, {
        user: userPseudo.substring(0, 50) + "...",
        guru: guruPseudo.substring(0, 50) + "...",
        exactMatch: userPseudo === guruPseudo
      });

      // 🔥 EXACT MATCH = 100%, SIMILARITY tinggi = 80-90%
      if (userPseudo === guruPseudo) {
        pseudoScore = 100;
        pseudoDetails = { 
          match: true, 
          score: 100, 
          feedback: "✅ IDENTIK dengan jawaban guru!",
          exactMatch: true 
        };
      } else {
        // Similarity score (Levenshtein-like)
        const similarity = calculateSimilarity(userPseudo, guruPseudo);
        pseudoScore = Math.max(0, similarity * 100);
        pseudoDetails = { 
          match: false, 
          score: pseudoScore, 
          feedback: `⚠️ Similarity ${Math.round(pseudoScore)}% - Cek struktur & keyword`,
          similarity: Math.round(pseudoScore)
        };
      }
    }

    // 🔥 FLOWCHART VALIDATION - JSON OBJECT COMPARE
    let flowScore = 0;
    let flowDetails = { match: false, score: 0, feedback: "❌ Flowchart kosong" };

    if (workspace.flowchart && guruAnswer?.flowchart) {
      try {
        // Parse user flowchart (safe)
        let userFlow = workspace.flowchart;
        if (typeof userFlow === 'string') {
          userFlow = JSON.parse(userFlow.replace(/\\"/g, '"'));
        }

        let guruFlow = guruAnswer.flowchart;
        if (typeof guruFlow === 'string') {
          guruFlow = JSON.parse(guruFlow);
        }

        console.log(`🔍 FLOW COMPARE:`, {
          userConditions: userFlow?.conditions?.length || 0,
          guruConditions: guruFlow?.conditions?.length || 0
        });

        // 🔥 COMPARE CONDITIONS (FLEXIBLE tapi ketat)
        const userConditions = Array.isArray(userFlow.conditions) ? userFlow.conditions : [];
        const guruConditions = Array.isArray(guruFlow.conditions) ? guruFlow.conditions : [];

        let conditionMatch = 0;
        const maxConditions = Math.max(userConditions.length, guruConditions.length);
        
        // Check first condition exact match
        if (userConditions[0] && guruConditions[0]) {
          const userCond = normalizeCondition(userConditions[0].condition);
          const guruCond = normalizeCondition(guruConditions[0].condition);
          
          if (userCond === guruCond) {
            conditionMatch += 40;
          }
        }

        // Check structure similarity
        if (userConditions.length === guruConditions.length) {
          conditionMatch += 30;
        }
        if (userConditions.some(c => c.yes?.trim())) {
          conditionMatch += 20;
        }
        if (userFlow.elseInstruction?.trim() === guruFlow.elseInstruction?.trim()) {
          conditionMatch += 10;
        }

        flowScore = Math.min(100, conditionMatch);
        flowDetails = {
          match: flowScore >= 90,
          score: flowScore,
          feedback: `✅ ${userConditions.length} kondisi (${flowScore}%)`,
          userConditions: userConditions.length,
          guruConditions: guruConditions.length,
          firstMatch: conditionMatch >= 40
        };

      } catch (parseErr) {
        console.error("Flow parse error:", parseErr);
        flowDetails.feedback = "❌ Flowchart format salah";
      }
    }

    // 🔥 FINAL SCORE (60% pseudo + 40% flow)
    const totalScore = Math.round((pseudoScore * 0.6) + (flowScore * 0.4));
    const valid = totalScore >= 85; // Naikkan threshold

    console.log(`🎯 FINAL: Pseudo=${pseudoScore}% Flow=${flowScore}% TOTAL=${totalScore}% ${valid ? '✅ PASS' : '❌ FAIL'}`);

    res.json({
      valid,
      score: totalScore,
      details: {
        pseudocode: pseudoDetails,
        flowchart: flowDetails,
        guruAnswer: {
          hasPseudo: !!guruAnswer?.pseudocode,
          hasFlow: !!guruAnswer?.flowchart,
          materiId: room.materiId
        }
      }
    });

  } catch (error) {
    console.error("❌ VALIDATE ERROR:", error);
    res.status(500).json({ valid: false, score: 0, error: error.message });
  }
};

// 🔥 NORMALIZE FUNCTIONS - CRUCIAL!
const normalizePseudocode = (text) => {
  if (!text) return "";
  
  return text
    // Hapus blanks
    .replace(/___BLANK_\d+___|\$BLANK \d+\$/gi, '')
    // Bersihkan whitespace
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    // Hapus punctuation
    .replace(/[;:(),]/g, ' ')
    // Keyword variations
    .replace(/\bIF\b/gi, 'if')
    .replace(/\bTHEN\b/gi, 'then')
    .replace(/\bENDIF\b/gi, 'endif')
    .replace(/\bEND\b/gi, 'end')
    // Trim & lowercase
    .trim()
    .toLowerCase();
};

const normalizeCondition = (condition) => {
  if (!condition) return "";
  return condition
    .replace(/\s+/g, ' ')
    .replace(/[()]/g, '')
    .trim()
    .toLowerCase();
};

// 🔥 SIMILARITY HELPER
const calculateSimilarity = (str1, str2) => {
  str1 = str1.toLowerCase().trim();
  str2 = str2.toLowerCase().trim();
  
  if (str1.length === 0 || str2.length === 0) return 0;
  
  const longer = Math.max(str1.length, str2.length);
  const matrix = [];
  
  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      if (str1.charAt(i - 1) === str2.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return 1 - (matrix[str1.length][str2.length] / longer);
};

// 🔥 VALIDASI PSEUDOCODE BARU
const validatePseudocode = (user, answer, materiId) => {
  // 1. STRUCTURE CHECK (40%)
  const hasStructure = {
    deklarasi: user.includes('deklarasi'),
    algoritma: user.includes('algoritma'),
    read: user.includes('read'),
    if: user.includes('if'),
    write: user.includes('write'),
    endif: user.includes('endif') || user.includes('end')
  };
  
  let score = 0;
  if (hasStructure.deklarasi && hasStructure.algoritma) score += 20;
  if (hasStructure.read) score += 10;
  if (hasStructure.if) score += 10;
  
  // 2. MATERI SPECIFIC (40%)
  const specificChecks = {
    1: ['angka', '> 0', 'positif'],
    2: ['nilai', '>= 70', 'lulus'],
    3: ['umur', '<= 12', 'kategori']
  };
  
  const checks = specificChecks[materiId] || specificChecks[1];
  const specificMatch = checks.some(check => user.includes(check));
  if (specificMatch) score += 40;
  
  // 3. CLOSING (20%)
  if (hasStructure.write && hasStructure.endif) score += 20;
  
  console.log(`📊 PSEUDO ${materiId}: ${score}% | Struct:`, hasStructure, `Specific: ${specificMatch}`);
  return Math.min(100, score);
};

// 🔥 VALIDASI FLOWCHART BARU
const validateFlowchart = (flowRaw, materiId) => {
  if (!flowRaw) {
    return { match: false, score: 0, feedback: "❌ Flowchart kosong" };
  }
  
  try {
    const flow = JSON.parse(flowRaw);
    const conditions = Array.isArray(flow.conditions) ? flow.conditions : [];
    
    if (conditions.length === 0) {
      return { match: false, score: 0, feedback: "❌ Tambah minimal 1 kondisi" };
    }
    
    // CEK KONDISI BERDASARKAN MATERI
    const expectedConditions = {
      1: ['> 0', 'angka > 0'],
      2: ['>= 70', 'nilai >= 70'],
      3: ['<= 12', 'umur <= 12']
    };
    
    const userCond = (conditions[0].condition || '').toLowerCase().trim();
    const expects = expectedConditions[materiId] || expectedConditions[1];
    const condMatch = expects.some(exp => userCond.includes(exp));
    
    let score = condMatch ? 70 : 30;
    
    // BONUS: YES instruction ada
    if (conditions[0].yes?.trim()) score += 20;
    if (conditions.length > 1) score += 10; // Multi kondisi bonus
    
    const feedback = condMatch 
      ? "✅ Kondisi BENAR!" 
      : `⚠️ Kondisi "${userCond}" - coba "${expects[0]}"`;
    
    return { 
      match: score >= 80, 
      score: Math.min(100, score), 
      feedback,
      conditionsFound: conditions.length,
      firstCond: userCond
    };
    
  } catch (e) {
    return { match: false, score: 0, feedback: "❌ Flowchart rusak" };
  }
};

// 🔥 DEBUG ENDPOINT - LIHAT APA YANG SALAH
exports.debugValidationRaw = async (req, res) => {
  try {
    const { roomId } = req.params;
    const workspace = await Workspace.findOne({ where: { roomId: parseInt(roomId) } });
    const room = await DiscussionRoom.findByPk(roomId);
    
// 🔥 NORMALIZER YANG PALING BENAR
const normalize = (text) => {
  if (!text || typeof text !== 'string') return "";
  
  return text
    // 1. Hapus semua blanks
    .replace(/___BLANK_\d+___/gi, '')
    .replace(/\$BLANK\s*\d+\$/gi, '')
    .replace(/\$\s*BLANK\s*\d+\s*\$/gi, '')
    
    // 2. Bersihkan spasi & newline
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    
    // 3. Hapus tanda baca yang mengganggu
    .replace(/[:;(),]/g, ' ')
    
    // 4. Trim & lowercase
    .trim()
    .toLowerCase();
};

    const userRaw = workspace?.pseudocode || "";
    const userPseudo = normalize(userRaw);
    
    const materiNum = room?.materiId || 1;
    let expectedRaw = "";
    
    switch (parseInt(materiNum)) {
      case 1:
        expectedRaw = `DEKLARASI 
    angka : integer

ALGORITMA 
    read(angka)
    
    IF (angka > 0) THEN 
        write("Angka ", angka, " adalah Positif")
    ENDIF 

END`;
        break;
      default:
        expectedRaw = `DEKLARASI angka : integer ALGORITMA read(angka) IF (angka > 0) THEN write("Angka ", angka, " adalah Positif") ENDIF END`;
    }
    
    const answerPseudo = normalize(expectedRaw);
    
    res.json({
      success: true,
      roomId,
      materiId: materiNum,
      
      user: {
        raw: userRaw,
        normalized: userPseudo,
        length: userPseudo.length
      },
      
      answer: {
        raw: expectedRaw,
        normalized: answerPseudo,
        length: answerPseudo.length
      },
      
      comparison: {
        exactMatch: userPseudo === answerPseudo,
        similarity: (userPseudo.length / answerPseudo.length * 100).toFixed(1) + "%",
        commonWords: userPseudo.split(' ').filter(word => answerPseudo.includes(word))
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Buat endpoint baru untuk template dinamis
// 🔥 FULL DYNAMIC TEMPLATE - discussionController.js
exports.getDynamicTemplate = async (req, res) => {
  try {
    const { materiId } = req.params;
    const materiNum = parseInt(materiId);
    
    console.log(`📝 [MATERI ${materiNum}] Loading dynamic template...`);

    let template = "";
    let blanks = [];
    let expectedFull = "";
    let instructions = "";

    // 🔥 DYNAMIC TEMPLATE BERDASARKAN MATERI
    switch (materiNum) {
      case 1: // ✅ IF SEDERHANA
        template = `DEKLARASI
    ___BLANK_0___ : integer

ALGORITMA
    read(___BLANK_1___)
    
    IF (___BLANK_2___) THEN
        write("___BLANK_3___", ___BLANK_4___, " adalah Positif")
    ENDIF

END`;

        blanks = [
          { id: 0, hint: "Nama variabel", example: "angka" },
          { id: 1, hint: "Variabel input", example: "angka" },
          { id: 2, hint: "Kondisi IF", example: "angka > 0" },
          { id: 3, hint: "Pesan awal", example: "Angka " },
          { id: 4, hint: "Variabel output", example: "angka" }
        ];

        expectedFull = `DEKLARASI
    angka : integer

ALGORITMA
    read(angka)
    
    IF (angka > 0) THEN
        write("Angka ", angka, " adalah Positif")
    ENDIF

END`;

        instructions = "Isi 5 blank untuk program cek angka positif!";
        break;

      case 2: // ✅ IF-ELSE
        template = `DEKLARASI
    ___BLANK_0___ : integer

ALGORITMA
    read(___BLANK_1___)

    IF (___BLANK_2___) THEN
        write("Status: Lulus")
    ___BLANK_3___
        write("Status: Tidak Lulus")
    ___BLANK_4___

END`;

        blanks = [
          { id: 0, hint: "Nama variabel", example: "nilai" },
          { id: 1, hint: "Variabel input", example: "nilai" },
          { id: 2, hint: "Kondisi lulus (≥70)", example: "nilai >= 70" },
          { id: 3, hint: "Keyword ELSE", example: "ELSE" },
          { id: 4, hint: "Tutup struktur", example: "ENDIF" }
        ];

        expectedFull = `DEKLARASI
    nilai : integer

ALGORITMA
    read(nilai)

    IF (nilai >= 70) THEN
        write("Status: Lulus")
    ELSE
        write("Status: Tidak Lulus")
    ENDIF

END`;

        instructions = "Isi 5 blank untuk program pengecekan kelulusan!";
        break;

      case 3: // ✅ IF-ELSE IF-ELSE (MULTI KONDISI)
        template = `DEKLARASI
    ___BLANK_0___ : integer

ALGORITMA
    read(___BLANK_1___)

    IF (___BLANK_2___) THEN
        write("Kategori: Anak-anak")
    ___BLANK_3___ (___BLANK_4___) THEN
        write("Kategori: Remaja")
    ___BLANK_5___ (___BLANK_6___) THEN
        write("Kategori: Dewasa")
    ___BLANK_7___
        write("Kategori: Lansia")
    ___BLANK_8___

END`;

        blanks = [
          { id: 0, hint: "Nama variabel", example: "umur" },
          { id: 1, hint: "Variabel input", example: "umur" },
          { id: 2, hint: "Kondisi anak (≤12)", example: "umur <= 12" },
          { id: 3, hint: "ELSE IF pertama", example: "ELSE IF" },
          { id: 4, hint: "Kondisi remaja (≤17)", example: "umur <= 17" },
          { id: 5, hint: "ELSE IF kedua", example: "ELSE IF" },
          { id: 6, hint: "Kondisi dewasa (≤59)", example: "umur <= 59" },
          { id: 7, hint: "Keyword ELSE", example: "ELSE" },
          { id: 8, hint: "Tutup struktur", example: "ENDIF" }
        ];

        expectedFull = `DEKLARASI
    umur : integer

ALGORITMA
    read(umur)

    IF (umur <= 12) THEN
        write("Kategori: Anak-anak")
    ELSE IF (umur <= 17) THEN
        write("Kategori: Remaja")
    ELSE IF (umur <= 59) THEN
        write("Kategori: Dewasa")
    ELSE
        write("Kategori: Lansia")
    ENDIF

END`;

        instructions = "Isi 9 blank untuk klasifikasi umur lengkap!";
        break;

      default: // FALLBACK untuk materi lain
        console.log(`⚠️ Unknown materi ${materiNum}, using Materi 1`);
        // Gunakan template materi 1 sebagai fallback
        template = `DEKLARASI
    ___BLANK_0___ : integer

ALGORITMA
    read(___BLANK_1___)
    
    IF (___BLANK_2___) THEN
        write("___BLANK_3___", ___BLANK_4___)
    ENDIF

END`;

        blanks = [
          { id: 0, hint: "Nama variabel", example: "angka" },
          { id: 1, hint: "Variabel input", example: "angka" },
          { id: 2, hint: "Kondisi", example: "angka > 0" },
          { id: 3, hint: "Pesan", example: "Angka " },
          { id: 4, hint: "Variabel output", example: "angka" }
        ];

        expectedFull = `DEKLARASI
    angka : integer

ALGORITMA
    read(angka)
    
    IF (angka > 0) THEN
        write("Angka ", angka)
    ENDIF

END`;

        instructions = "Template default - cek materi ID!";
    }

    // 🔥 RESPONSE LENGKAP
    const response = {
      status: true,
      data: {
        materiId: materiNum,
        template,
        blanks,
        expectedFull,
        totalBlanks: blanks.length,
        instructions,
        blankCount: {
          variabel: blanks.filter(b => b.hint.includes("variabel")).length,
          kondisi: blanks.filter(b => b.hint.includes("kondisi")).length,
          struktur: blanks.filter(b => b.hint.includes("ELSE") || b.hint.includes("ENDIF")).length
        }
      }
    };

    console.log(`✅ [MATERI ${materiNum}] Template OK: ${blanks.length} blanks`);
    res.json(response);

  } catch (error) {
    console.error("❌ getDynamicTemplate ERROR:", error);
    
    // 🔥 FAILSAFE - SELALU KASIH TEMPLATE MATERI 1
    res.json({
      status: true, // ✅ JANGAN FALSE, BIAR FRONTEND TETEP JALAN
      data: {
        materiId: 1,
        template: `DEKLARASI
___BLANK_0___ : integer

ALGORITMA
read(___BLANK_1___)
IF (___BLANK_2___) THEN
write("___BLANK_3___", ___BLANK_4___)
ENDIF
END`,
        blanks: [
          { id: 0, hint: "Nama variabel", example: "angka" },
          { id: 1, hint: "Variabel input", example: "angka" },
          { id: 2, hint: "Kondisi", example: "angka > 0" },
          { id: 3, hint: "Pesan", example: "Angka " },
          { id: 4, hint: "Variabel output", example: "angka" }
        ],
        expectedFull: `DEKLARASI
angka : integer

ALGORITMA
read(angka)
IF (angka > 0) THEN
write("Angka ", angka)
ENDIF
END`,
        totalBlanks: 5,
        instructions: "Emergency fallback template"
      }
    });
  }
};

/* ================= TIMER SYSTEM ================= */
exports.startRoomTimer = async (req, res) => {
  try {
    const { roomId } = req.params;
    const duration = 100 * 1000; // 60 minutes
    const timerEnd = new Date(Date.now() + duration);
    
    await DiscussionRoom.update(
      { timerStart: new Date(), timerEnd },
      { where: { id: roomId } }
    );
    
    res.json({ 
      status: true, 
      timerEnd: timerEnd.toISOString(), 
      duration: 100,
      message: "Timer dimulai - 60 menit" 
    });
  } catch (error) {
    console.error("startRoomTimer error:", error);
    res.status(500).json({ status: false, message: "Gagal start timer" });
  }
};

exports.checkTimerStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await DiscussionRoom.findByPk(roomId);
    
    if (!room?.timerEnd) {
      return res.json({ timeLeft: 3600, overtimeMinutes: 0, penaltyXP: 0, expired: false });
    }
    
    const now = Date.now();
    const timeLeft = Math.max(0, (new Date(room.timerEnd) - now) / 1000);
    const overtimeMs = Math.max(0, now - new Date(room.timerEnd).getTime());
    const overtimeMinutes = Math.floor(overtimeMs / 60000);
    const penaltyXP = Math.floor(overtimeMinutes / 5) * 10;
    
    res.json({
      timeLeft: Math.floor(timeLeft),
      overtimeMinutes,
      penaltyXP,
      expired: timeLeft <= 0
    });
  } catch (error) {
    console.error("checkTimerStatus error:", error);
    res.status(500).json({ timeLeft: 0, penaltyXP: 0, expired: false });
  }
};

/* ================= GET WORKSPACE ATTEMPTS (ADMIN) ================= */
exports.getWorkspaceAttempts = async (req, res) => {
  try {
    const { roomId } = req.params;
    const attempts = await WorkspaceAttempt.findAll({
      where: { roomId },
      order: [['createdAt', 'ASC']],
    });
    res.json({ status: true, data: attempts });
  } catch (err) {
    console.error("getWorkspaceAttempts:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// discussionController.js - TAMBAHKAN INI
exports.toggleTask = async (req, res) => {
  try {
    const { roomId, taskId } = req.params;
    const { done } = req.body;

    await RoomTaskProgress.upsert({
      roomId: parseInt(roomId),
      taskId: parseInt(taskId),
      done: !!done
    });

    res.json({ status: true, message: "Task updated" });
  } catch (err) {
    console.error("toggleTask error:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// 🔥 XP PENALTY HELPER
const applyAttemptPenalty = async (roomId, type, transaction) => {
  const room = await DiscussionRoom.findByPk(roomId, { transaction });
  if (!room?.materiId) return 0;
  
  const attemptCount = await WorkspaceAttempt.count({
    where: { roomId, type },
    transaction
  });
  
  if (attemptCount <= 5) return 0; // No penalty
  
  const penalty = 10 * (attemptCount - 5); // 10XP per extra attempt
  const members = await UserMateriProgress.findAll({
    where: { materiId: room.materiId, roomId },
    transaction
  });
  
  for (const member of members) {
    if (member.xp >= penalty) {
      member.xp -= penalty;
      await member.save({ transaction });
      
      await User.update(
        { xp: User.sequelize.literal(`xp - ${penalty}`) },
        { where: { id: member.userId }, transaction }
      );
    }
  }
  
  console.log(`💰 Penalty ${type} room ${roomId}: -${penalty}XP x${members.length} (attempt ${attemptCount})`);
  return penalty;
};

exports.debugValidation = async (req, res) => {
  try {
    const { roomId } = req.params;
    const [workspace, room, answer] = await Promise.all([
      Workspace.findOne({ where: { roomId: parseInt(roomId) } }),
      DiscussionRoom.findByPk(roomId),
      MateriAnswer.findOne({ where: { materiId: room?.materiId } })
    ]);
    
    res.json({
      success: true,
      roomId,
      workspaceFound: !!workspace,
      answerFound: !!answer,
      userPseudo: workspace?.pseudocode,
      answerPseudo: answer?.pseudocode,
      userHasBlanks: workspace?.pseudocode?.includes('[BLANK'),
      lengths: {
        user: workspace?.pseudocode?.length,
        answer: answer?.pseudocode?.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// 🔥 DEBUG ROOM (ADMIN ONLY) - TAMBAHKAN INI
exports.debugRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const room = await DiscussionRoom.findByPk(roomId, {
      include: [
        { 
          model: UserMateriProgress, 
          as: 'members', 
          attributes: ['userId', 'xp', 'percent'],
          include: [{ model: User, attributes: ['name'] }]
        }
      ]
    });
    
    res.json({ 
      status: true, 
      room: room?.toJSON() || null,
      memberCount: room?.members?.length || 0,
      message: "Debug room OK ✅" 
    });
  } catch (error) {
    console.error("debugRoom error:", error);
    res.status(500).json({ status: false, message: error.message });
  }
};
module.exports = exports;