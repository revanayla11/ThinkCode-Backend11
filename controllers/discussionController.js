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
exports.getWorkspaceData = async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const workspace = await Workspace.findOne({ where: { roomId } });
    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });

    const taskMap = {};
    tasks.forEach(t => { taskMap[t.taskId] = t.done; });
    for (let i = 1; i <= 5; i++) {
      if (!taskMap[i]) taskMap[i] = false;
    }

    // 🔥 SUPER SAFE FLOWCHART PARSE
    let flowchartObj = { conditions: [], elseInstruction: "" };
    if (workspace?.flowchart) {
      try {
        const parsed = typeof workspace.flowchart === 'string' 
          ? JSON.parse(workspace.flowchart) 
          : workspace.flowchart;
        
        // ✅ VALIDATE STRUCTURE
        flowchartObj = {
          conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
          elseInstruction: parsed.elseInstruction || "",
          showElse: !!parsed.showElse
        };
        
        console.log("✅ FLOWCHART PARSED:", {
          conditions: flowchartObj.conditions.length,
          firstCond: flowchartObj.conditions[0]?.condition
        });
        
      } catch (e) {
        console.error("❌ Flowchart PARSE ERROR:", e.message, "Raw:", workspace.flowchart);
        flowchartObj = { conditions: [], elseInstruction: "", parseError: e.message };
      }
    }

    res.json({
      status: true,
      data: {
        pseudocode: workspace?.pseudocode || "",
        flowchart: flowchartObj,
        tasks: taskMap
      }
    });

  } catch (err) {
    console.error("getWorkspaceData ERROR:", err);
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

/* ================= SAVE PSEUDOCODE - FIXED ================= */
exports.savePseudocode = async (req, res) => {
  const transaction = await Workspace.sequelize.transaction();
  try {
    const roomId = parseInt(req.params.roomId);
    const userId = req.user.id;

    let filledPseudocode = "";

    // 🔥 FALLBACK 1: Cek template + answers (NEW FORMAT)
    if (req.body.template && Array.isArray(req.body.answers)) {
      filledPseudocode = fillBlanks(req.body.template, req.body.answers);
      console.log("✅ NEW FORMAT: template + answers");
    }
    // 🔥 FALLBACK 2: Cek pseudocode langsung (OLD FORMAT)
    else if (req.body.pseudocode) {
      filledPseudocode = req.body.pseudocode.trim();
      console.log("✅ OLD FORMAT: pseudocode direct");
    }
    else {
      await transaction.rollback();
      return res.status(400).json({ message: "Data pseudocode kosong" });
    }

    // 🔥 NORMALIZE
    const cleaned = filledPseudocode
      .replace(/\s+/g, ' ')
      .trim();

    console.log("🧪 SAVED:", cleaned.substring(0, 100) + "...");

    // 🔥 SIMPAN
    await Workspace.upsert({
      roomId,
      pseudocode: cleaned
    }, { transaction });

    // Count attempts
    const attemptCount = await WorkspaceAttempt.count({
      where: { roomId, type: "pseudocode" },
      transaction
    });

    await WorkspaceAttempt.create({
      roomId,
      type: "pseudocode",
      attemptNumber: attemptCount + 1,
      content: cleaned
    }, { transaction });

    await RoomTaskProgress.upsert({ 
      roomId, 
      taskId: 3, 
      done: true 
    }, { transaction });

    await transaction.commit();

    res.json({
      status: true,
      message: "✅ Pseudocode saved!",
      preview: cleaned.substring(0, 100) + "...",
      attempts: attemptCount + 1
    });

  } catch (err) {
    await transaction.rollback();
    console.error("savePseudocode ERROR:", err);
    res.status(500).json({ message: err.message });
  }
};

// 🔥 HELPER FUNCTION - Tambahkan ini
const fillBlanks = (template, answers) => {
  let filled = template || "";
  answers.forEach((answer, i) => {
    const placeholder = `___BLANK_${i}___`;
    filled = filled.replaceAll(placeholder, answer || `[BLANK ${i+1}]`);
  });
  return filled;
};
/* ================= SAVE FLOWCHART ================= */
exports.saveFlowchart = async (req, res) => {
  const transaction = await Workspace.sequelize.transaction();
  try {
    const roomId = parseInt(req.params.roomId);
    let { flowchart } = req.body;

    console.log(`🔧 [SAVE FLOWCHART ${roomId}] Raw:`, JSON.stringify(flowchart)?.slice(0, 200));

    // Parse & validate (sama seperti sebelumnya)
    if (typeof flowchart === 'string') {
      flowchart = JSON.parse(flowchart);
    }

    if (!flowchart?.conditions?.length) {
      return res.status(400).json({ error: "Minimal 1 kondisi" });
    }

    const cleanFlowchart = {
      conditions: flowchart.conditions.map(c => ({
        condition: (c.condition || '').trim(),
        yes: (c.yes || '').trim(),
        no: c.no?.trim() || ''
      })).filter(c => c.condition),
      elseInstruction: (flowchart.elseInstruction || '').trim(),
      showElse: !!flowchart.showElse
    };

    // 🔥 CRITICAL FIX: GET EXISTING WORKSPACE FIRST
    const existing = await Workspace.findOne({ where: { roomId }, transaction });
    const pseudocode = existing?.pseudocode || ""; // PRESERVE PSEUDOCODE!

    console.log(`📊 Existing pseudo len: ${pseudocode.length}, flow conditions: ${cleanFlowchart.conditions.length}`);

    // 🔥 UPSERT with BOTH fields
    await Workspace.upsert({
      roomId,
      pseudocode: pseudocode,        // ✅ PRESERVE
      flowchart: JSON.stringify(cleanFlowchart)  // ✅ NEW
    }, { transaction });

    // Save attempt
    await WorkspaceAttempt.create({
      roomId, type: "flowchart", 
      attemptNumber: (await WorkspaceAttempt.count({ where: { roomId, type: "flowchart" }, transaction })) + 1,
      content: JSON.stringify(cleanFlowchart)
    }, { transaction });

    await RoomTaskProgress.upsert({ roomId, taskId: 4, done: true }, { transaction });
    
    await transaction.commit();

    console.log(`💾 [SUCCESS ${roomId}] Flowchart saved! Conditions: ${cleanFlowchart.conditions.length}`);
    
    res.json({ 
      status: true, 
      message: `✅ Flowchart tersimpan (${cleanFlowchart.conditions.length} kondisi)!`,
      data: { conditions: cleanFlowchart.conditions.length }
    });

  } catch (err) {
    await transaction.rollback();
    console.error("❌ saveFlowchart:", err);
    res.status(500).json({ error: err.message });
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

exports.validateWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params;
    const safeRoomId = parseInt(roomId);
    
    console.log(`🔍 VALIDATE roomId: ${safeRoomId}`);

    const room = await DiscussionRoom.findByPk(safeRoomId);
    if (!room) return res.status(404).json({ valid: false, score: 0, error: "Room not found" });

    const workspace = await Workspace.findOne({ where: { roomId: safeRoomId } });
    if (!workspace) return res.json({ valid: false, score: 0, message: "Workspace kosong" });

    const materiId = parseInt(room.materiId || 1);

    // PSEUDOCODE
    let pseudoScore = 0;
    if (workspace.pseudocode?.trim()) {
      const userClean = normalize(workspace.pseudocode);
      const expected = normalize(getExpectedAnswer(materiId));
      const keywords = ['deklarasi', 'algoritma', 'read', 'if', 'write', 'endif'];
      const matches = keywords.filter(kw => userClean.includes(kw));
      pseudoScore = Math.min(100, (matches.length / keywords.length) * 80);
    }

    // 🔥 FLOWCHART - ULTRA SAFE PARSING
    let flowScore = 0, flowFeedback = "Belum ada flowchart";
    const flowRaw = workspace.flowchart;
    
    console.log(`🔄 Flow raw type: ${typeof flowRaw}, len: ${flowRaw?.length}, preview: "${flowRaw?.slice(0, 50)}..."`);

    if (flowRaw && flowRaw.trim().length > 10) {  // Minimal JSON length
      try {
        let flowObj;
        
        // 🔥 CASE 1: Already object
        if (typeof flowRaw === 'object') {
          flowObj = flowRaw;
        } 
        // 🔥 CASE 2: JSON string (escaped)
        else if (typeof flowRaw === 'string') {
          // Unescape double quotes first
          const unescaped = flowRaw.replace(/\\"/g, '"');
          console.log(`🔧 Unescaped: "${unescaped.slice(0, 50)}..."`);
          flowObj = JSON.parse(unescaped);
        }
        
        console.log(`✅ PARSED FLOW:`, flowObj);

        const conditions = Array.isArray(flowObj?.conditions) ? flowObj.conditions : [];
        
        if (conditions.length > 0) {
          const firstCond = (conditions[0].condition || '').toLowerCase().trim();
          const hasYes = !!(conditions[0].yes?.trim());
          
          flowScore = 40;
          if (firstCond.includes('> 0') || firstCond.includes('positif') || firstCond.includes('>')) flowScore += 30;
          if (hasYes) flowScore += 30;
          
          flowFeedback = `✅ ${conditions.length} kondisi (${firstCond})`;
        }
      } catch (parseErr) {
        console.error(`❌ PARSE ERROR: ${parseErr.message}`);
        console.error(`Raw flowchart:`, flowRaw);
        flowFeedback = "❌ JSON rusak";
      }
    }

    const totalScore = Math.round((pseudoScore * 0.6) + (flowScore * 0.4));
    const valid = totalScore >= 75;

    console.log(`📊 RESULT: Pseudo:${pseudoScore} Flow:${flowScore} Total:${totalScore}%`);

    res.json({
      valid,
      score: totalScore,
      details: {
        pseudocode: {
          match: pseudoScore >= 80,
          score: pseudoScore,
          feedback: pseudoScore >= 80 ? "✅ Perfect!" : "⚠️ Perbaiki"
        },
        flowchart: {
          match: flowScore >= 80,
          score: flowScore,
          feedback: flowFeedback,
          rawPreview: flowRaw?.slice(0, 50) + "..."
        }
      }
    });

  } catch (error) {
    console.error("VALIDATE ERROR:", error);
    res.status(500).json({ valid: false, score: 0, error: error.message });
  }
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