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

/* ================= PERFORMANCE SCORING ================= */
/* ================= PERFORMANCE SCORING ================= */
exports.getRoomPerformance = async (req, res) => {
  try {
    const { roomId } = req.params;

    // 🔥 CLUES (-10% per clue, max 30%)
    const usedClues = await DiscussionClueLog.count({ where: { roomId } });
    const cluePenalty = Math.min(usedClues * 10, 30);

    // 🔥 ATTEMPTS (-5% mulai attempt 6+)
    const pseudoAttempts = await WorkspaceAttempt.count({ where: { roomId, type: "pseudocode" } });
    const flowchartAttempts = await WorkspaceAttempt.count({ where: { roomId, type: "flowchart" } });
    const totalAttempts = pseudoAttempts + flowchartAttempts;
    const attemptsAbove5 = Math.max(0, totalAttempts - 5);
    const attemptPenalty = attemptsAbove5 * 5;

    // 🔥 TASKS (+10% jika semua selesai)
    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    const allTasksDone = tasks.length === 5 && tasks.every(t => t.done);
    const taskBonus = allTasksDone ? 10 : 0;

    // 🔥 FINAL SCORE
    let score = 100;
    score -= cluePenalty;
    score -= attemptPenalty;
    score += taskBonus;
    score = Math.max(0, Math.min(100, score));

    // 🔥 🔥 NEW: PENALTY XP TIER INFO
    let xpPenaltyTier = 'Safe (0XP)';
    let nextXPPenalty = 0;
    if (totalAttempts > 10) {
      xpPenaltyTier = 'Extreme (-25XP)';
      nextXPPenalty = 25;
    } else if (totalAttempts > 5) {
      xpPenaltyTier = 'High (-10XP)';
      nextXPPenalty = 10;
    } else if (totalAttempts > 3) {
      xpPenaltyTier = 'Medium (-5XP)';
      nextXPPenalty = 5;
    }

    console.log(`📊 Performance room ${roomId}:`, {
      usedClues,
      totalAttempts,
      attemptsAbove5,
      allTasksDone,
      score: Math.round(score),
      xpPenaltyTier,
      nextXPPenalty
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
      allTasksDone,
      breakdown: {
        base: 100,
        cluePenalty,
        attemptPenalty,
        taskBonus
      },
      // 🔥 NEW: XP PENALTY INFO
      xpPenalty: {
        tier: xpPenaltyTier,
        totalAttempts,
        nextPenalty: nextXPPenalty,
        warning: totalAttempts > 3 ? `⚠️ Next attempt: -${nextXPPenalty}XP per member!` : '✅ Safe zone'
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

/* ================= WORKSPACE DATA ================= */
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
        flowchart: flowchartObj,
        tasks: taskMap
      }
    });

  } catch (err) {
    console.error("getWorkspaceData:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

// 🔥 TAMBAH INI - SUDAH ADA TAPI PASTIKAN ROUTES
exports.getTaskProgress = async (req, res) => {
  try {
    const { roomId } = req.params;
    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    
    // INIT 5 TASKS
    const taskMap = {1: false, 2: false, 3: false, 4: false, 5: false};
    tasks.forEach(t => { 
      taskMap[t.taskId] = t.done; 
    });
    
    console.log(`📋 TASKS ${roomId}:`, taskMap);
    
    res.json({ 
      status: true, 
      data: taskMap 
    });
  } catch (err) {
    console.error("getTaskProgress:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= FILL BLANKS HELPER ================= */
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

/* ================= SAVE PSEUDOCODE ================= */
exports.savePseudocode = async (req, res) => {
  const transaction = await Workspace.sequelize.transaction();
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
      await transaction.rollback();
      return res.status(400).json({ 
        error: "No pseudocode data! Kirim template+answers atau pseudocode" 
      });
    }

    if (!filledPseudocode.trim()) {
      await transaction.rollback();
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
    }, { transaction });

    // 🔥 TASK 3 DONE
    await RoomTaskProgress.upsert({ 
      roomId, 
      taskId: 3, 
      done: true 
    }, { transaction });
    
    // 🔥 ATTEMPT COUNT & CREATE LOG - DULU!
    const attemptCount = await WorkspaceAttempt.count({ 
      where: { roomId, type: 'pseudocode' }, 
      transaction 
    });
    
    await WorkspaceAttempt.create({
      roomId, 
      type: 'pseudocode', 
      attemptNumber: attemptCount + 1, 
      content: cleaned
    }, { transaction });

    // 🔥 🔥 FIXED: APPLY PENALTY SETELAH ATTEMPT DIBUAT
    const penaltyResult = await exports.applyAttemptPenalty(roomId, transaction);
    console.log(`🎯 PSEUDO PENALTY room ${roomId}:`, penaltyResult);

    await transaction.commit();

    console.log(`✅ PSEUDO #${attemptCount + 1} SAVED room ${roomId}`);

    res.json({
      status: true,
      message: `✅ Pseudocode tersimpan! (Attempt ${attemptCount + 1})`,
      preview: cleaned.substring(0, 80) + (cleaned.length > 80 ? '...' : ''),
      attempts: attemptCount + 1,
      length: cleaned.length,
      // 🔥 NEW PENALTY INFO
      penalty: penaltyResult
    });

  } catch (error) {
    await transaction.rollback();
    console.error('💥 savePseudocode ERROR:', error);
    res.status(500).json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

/* ================= SAVE FLOWCHART ================= */
exports.saveFlowchart = async (req, res) => {
  console.log('🚀 saveFlowchart START');
  
  const transaction = await Workspace.sequelize.transaction();
  try {
    const roomId = parseInt(req.params.roomId);
    const { flowchart } = req.body;

    console.log('📥 FLOWCHART:', JSON.stringify(flowchart, null, 2));

    // 🔥 GET EXISTING WORKSPACE
    const existing = await Workspace.findOne({ where: { roomId }, transaction });
    if (!existing) {
      await transaction.rollback();
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
      await transaction.rollback();
      return res.status(400).json({ error: 'No valid conditions' });
    }

    // 🔥 UPDATE - KEEP PSEUDOCODE!
    await Workspace.update({
      flowchart: cleanFlow,
      updatedAt: new Date()
    }, { 
      where: { roomId }, 
      transaction
    });

    // 🔥 TASK 4
    await RoomTaskProgress.upsert({ 
      roomId, 
      taskId: 4, 
      done: true 
    }, { transaction });

    // 🔥 ATTEMPT - DULU!
    const attemptCount = await WorkspaceAttempt.count({ 
      where: { roomId, type: 'flowchart' }, 
      transaction 
    });
    
    await WorkspaceAttempt.create({
      roomId, 
      type: 'flowchart', 
      attemptNumber: attemptCount + 1, 
      content: JSON.stringify(cleanFlow)
    }, { transaction });

    // 🔥 🔥 FIXED: APPLY PENALTY SETELAH ATTEMPT DIBUAT
    const penaltyResult = await exports.applyAttemptPenalty(roomId, transaction);

    // 🔥 VERIFY SAVE
    const verify = await Workspace.findOne({ where: { roomId }, transaction });
    console.log('✅ DB AFTER SAVE:', {
      pseudocodeLength: verify.pseudocode?.length || 0,
      flowchartConditions: verify.flowchart?.conditions?.length || 0
    });

    await transaction.commit();

    res.json({
      status: true,
      message: `✅ Saved ${cleanFlow.conditions.length} conditions`,
      data: {
        pseudocodeKept: !!existing.pseudocode,
        conditions: cleanFlow.conditions.length,
        attempts: attemptCount + 1,
        // 🔥 NEW PENALTY INFO
        penalty: penaltyResult
      }
    });

  } catch (error) {
    await transaction.rollback();
    console.error('💥 ERROR:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/* ================= DYNAMIC TEMPLATE ================= */
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
      case 1: // IF SEDERHANA
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

      case 2: // IF-ELSE
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

      case 3: // IF-ELSE IF-ELSE
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

      default:
        console.log(`⚠️ Unknown materi ${materiNum}, using Materi 1`);
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
    
    res.json({
      status: true,
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

/* ================= DYNAMIC VALIDATION + PERFORMANCE ================= */
const getExpectedAnswerByMateri = (materiId) => {
  const templates = {
    1: {
      pseudocode: `DEKLARASI 
angka : integer

ALGORITMA 
    read(angka)
    
    IF (angka > 0) THEN 
        write("Angka ", angka, " adalah Positif")
    ENDIF 

END`,
      flowchart: {
        conditions: [{ condition: "angka > 0", yes: 'write("Angka ", angka, " adalah Positif")', no: "" }],
        elseInstruction: "",
        showElse: false
      }
    },
    2: {
      pseudocode: `DEKLARASI 
nilai : integer

ALGORITMA 
    read(nilai)

    IF (nilai >= 70) THEN
        write("Status: Lulus")
    ELSE
        write("Status: Tidak Lulus")
    ENDIF

END`,
      flowchart: {
        conditions: [{ condition: "nilai >= 70", yes: 'write("Status: Lulus")', no: "" }],
        elseInstruction: 'write("Status: Tidak Lulus")',
        showElse: true
      }
    },
    3: {
      pseudocode: `DEKLARASI 
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

END`,
      flowchart: {
        conditions: [
          { condition: "umur <= 12", yes: 'write("Kategori: Anak-anak")', no: "" },
          { condition: "umur <= 17", yes: 'write("Kategori: Remaja")', no: "" },
          { condition: "umur <= 59", yes: 'write("Kategori: Dewasa")', no: "" }
        ],
        elseInstruction: 'write("Kategori: Lansia")',
        showElse: true
      }
    }
  };
  return templates[materiId] || templates[1];
};

const normalizePseudocode = (text) => {
  if (!text) return "";
  
  return text
    .replace(/___BLANK_\d+___|\$BLANK \d+\$/gi, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[;:(),]/g, ' ')
    .replace(/\bIF\b/gi, 'if')
    .replace(/\bTHEN\b/gi, 'then')
    .replace(/\bENDIF\b/gi, 'endif')
    .replace(/\bEND\b/gi, 'end')
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

const normalizeInstruction = (text) => {
  if (!text) return "";
  return text
    .replace(/write\s*\$/gi, '')
    .replace(/[""]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

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

exports.validateWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params;
    console.log(`🔍 VALIDATE START - Room: ${roomId}`);
    
    const [room, workspace] = await Promise.all([
      DiscussionRoom.findByPk(parseInt(roomId)),
      Workspace.findOne({ where: { roomId: parseInt(roomId) } })
    ]);

    if (!room) {
      return res.status(404).json({ valid: false, score: 0, error: "Room not found" });
    }
    
    if (!workspace) {
      return res.json({ valid: false, score: 0, message: "Workspace kosong" });
    }

    const materiId = room.materiId;
    const expected = getExpectedAnswerByMateri(materiId);
    
    // 🔥 PSEUDOCODE VALIDATION
    const userPseudoNorm = normalizePseudocode(workspace.pseudocode);
    const expectedPseudoNorm = normalizePseudocode(expected.pseudocode);
    const pseudoSimilarity = calculateSimilarity(userPseudoNorm, expectedPseudoNorm) * 100;
    
    // 🔥 FLOWCHART VALIDATION
    let flowchartScore = 0;
    if (workspace.flowchart && Array.isArray(workspace.flowchart.conditions)) {
      const userConditions = workspace.flowchart.conditions;
      const expectedConditions = expected.flowchart.conditions || [];
      
      let conditionMatches = 0;
      userConditions.forEach((userCond, i) => {
        if (i < expectedConditions.length) {
          const condSim = calculateSimilarity(
            normalizeCondition(userCond.condition), 
            normalizeCondition(expectedConditions[i].condition)
          );
          if (condSim > 0.7) conditionMatches++;
        }
      });
      
      flowchartScore = (conditionMatches / Math.max(userConditions.length, expectedConditions.length)) * 100;
    }

    const finalScore = Math.round((pseudoSimilarity * 0.6 + flowchartScore * 0.4));
    const isValid = finalScore >= 80;

    console.log(`✅ VALIDATION RESULT:`, {
      pseudoSimilarity: pseudoSimilarity.toFixed(1),
      flowchartScore: flowchartScore.toFixed(1),
      finalScore,
      isValid
    });

    res.json({
      valid: isValid,
      score: finalScore,
      details: {
        pseudocodeSimilarity: pseudoSimilarity.toFixed(1),
        flowchartScore: flowchartScore.toFixed(1),
        pseudocodeMatch: userPseudoNorm === expectedPseudoNorm,
        hasFlowchart: !!workspace.flowchart,
        conditionsCount: workspace.flowchart?.conditions?.length || 0
      }
    });

  } catch (error) {
    console.error("💥 VALIDATE ERROR:", error);
    res.status(500).json({ 
      valid: false, 
      score: 0, 
      error: "Validation timeout - coba lagi" 
    });
  }
};

/* ================= TASK FUNCTIONS ================= */
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

/* ================= TIMER SYSTEM ================= */
exports.startRoomTimer = async (req, res) => {
  try {
    const { roomId } = req.params;
    const duration = 3600 * 1000; // 60 minutes
    const timerEnd = new Date(Date.now() + duration);
    
    await DiscussionRoom.update(
      { timerStart: new Date(), timerEnd },
      { where: { id: roomId } }
    );
    
    res.json({ 
      status: true, 
      timerEnd: timerEnd.toISOString(), 
      duration: 3600,
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

/* ================= DEBUG ENDPOINTS ================= */
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

exports.debugValidationRaw = async (req, res) => {
  try {
    const { roomId } = req.params;
    const workspace = await Workspace.findOne({ where: { roomId: parseInt(roomId) } });
    const room = await DiscussionRoom.findByPk(roomId);
    
    const normalize = (text) => {
      if (!text || typeof text !== 'string') return "";
      
      return text
        .replace(/___BLANK_\d+___/gi, '')
        .replace(/\$BLANK\s*\d+\$/gi, '')
        .replace(/\$\s*BLANK\s*\d+\s*\$/gi, '')
        .replace(/[\r\n\t]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[:;(),]/g, ' ')
        .trim()
        .toLowerCase();
    };

    const userRaw = workspace?.pseudocode || "";
    const userPseudo = normalize(userRaw);
    
    const materiNum = room?.materiId || 1;
    let expectedRaw = "";
    
    switch (parseInt(materiNum)) {
      case 1:
        expectedRaw = `DEKLARASI angka : integer ALGORITMA read(angka) IF (angka > 0) THEN write("Angka ", angka, " adalah Positif") ENDIF END`;
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

// Di discussionController.js
exports.markRoomSubmitted = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    await DiscussionRoom.update(
      { isSubmitted: true }, 
      { where: { id: roomId } }
    );
    
    // Update semua member tasks
    await RoomTaskProgress.upsert({ roomId, taskId: 5, done: true });
    
    res.json({ 
      status: true, 
      message: "Room marked as submitted" 
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
};

/* ================= ATTEMPT PENALTY XP ================= */
/* ================= ATTEMPT PENALTY XP (FIXED) ================= */
exports.applyAttemptPenalty = async (roomId, transaction = null) => {
  try {
    console.log(`🎯 CHECKING PENALTY for room ${roomId}`);
    
    // 🔥 COUNT TOTAL ATTEMPTS
    const [pseudoAttempts, flowchartAttempts] = await Promise.all([
      WorkspaceAttempt.count({ where: { roomId, type: "pseudocode" }, transaction }),
      WorkspaceAttempt.count({ where: { roomId, type: "flowchart" }, transaction })
    ]);
    
    const totalAttempts = pseudoAttempts + flowchartAttempts;
    console.log(`📊 TOTAL ATTEMPTS: ${totalAttempts} (pseudo: ${pseudoAttempts}, flowchart: ${flowchartAttempts})`);
    
    // 🔥 PENALTY TIERS
    let penaltyXP = 0;
    let tier = 'Safe';
    if (totalAttempts > 10) {
      penaltyXP = 25;
      tier = 'Extreme';
    } else if (totalAttempts > 5) {
      penaltyXP = 10;
      tier = 'High';
    } else if (totalAttempts > 3) {
      penaltyXP = 5;
      tier = 'Medium';
    }
    
    if (penaltyXP === 0) {
      return { 
        applied: false, 
        penaltyXP: 0, 
        totalAttempts,
        tier: 'Safe',
        message: '✅ No penalty - masih aman!'
      };
    }

    // 🔥 GET ROOM & MEMBERS
    const room = await DiscussionRoom.findByPk(roomId, { transaction });
    if (!room) {
      return { applied: false, error: 'Room not found' };
    }
    
    const members = await UserMateriProgress.findAll({
      where: { materiId: room.materiId, roomId },
      transaction,
    });
    
    if (!members.length) {
      return { applied: false, message: 'Tidak ada anggota di room' };
    }

    // 🔥 🔥 FIX: POTONG XP SEMUA MEMBER SEKALIGUS - TANPA CHECK SATU-SATU
    const results = [];
    let allSuccess = true;
    
    for (const member of members) {
      try {
        // 🔥 SYNC XP DARI USER TABLE
        await exports.syncUserXp(member.userId, room.materiId, transaction);
        await member.reload({ transaction });

        // 🔥 CEK XP CUKUP
        if (member.xp < penaltyXP) {
          console.log(`⚠️ User ${member.userId} XP tidak cukup: ${member.xp} < ${penaltyXP}`);
          allSuccess = false;
          continue;
        }

        // 🔥 POTONG XP DI UserMateriProgress
        const beforeXP = member.xp;
        member.xp -= penaltyXP;
        await member.save({ transaction });

        // 🔥 POTONG XP DI User TABLE - ATOMIK
        const [updatedUserCount] = await User.update(
          { xp: User.sequelize.literal(`xp - ${penaltyXP}`) },
          { where: { id: member.userId }, transaction }
        );

        if (updatedUserCount > 0) {
          results.push({
            userId: member.userId,
            beforeXP,
            afterXP: member.xp,
            penalty: penaltyXP
          });
          console.log(`💸 [${tier}] User ${member.userId}: ${beforeXP}XP → ${member.xp}XP (-${penaltyXP}XP)`);
        }
      } catch (memberError) {
        console.error(`💥 Penalty error user ${member.userId}:`, memberError);
        allSuccess = false;
      }
    }

    // 🔥 KIRIM ALERT KE ROOM CHAT - SELALU KIRIM JIKA ADA YANG KEKENA
    if (results.length > 0) {
      await DiscussionMessage.create({
        roomId,
        userId: 1, // System user
        type: "system",
        message: `🚨 ATTEMPT PENALTY!\n💥 Total attempts: ${totalAttempts}\n⚡ ${tier} Penalty: **-${penaltyXP}XP** per member\n📉 ${results.length}/${members.length} anggota kena potong XP!\n\n⚠️ **Tips:** Kerjakan semua task dulu sebelum submit!`
      }, { transaction });

      console.log(`🔔 ALERT SENT: ${tier} penalty (${penaltyXP}XP) ke ${results.length}/${members.length} members`);
    }

    return { 
      applied: results.length > 0,
      penaltyXP, 
      totalAttempts, 
      tier,
      affectedMembers: results.length,
      totalMembers: members.length,
      successRate: `${Math.round((results.length/members.length)*100)}%`,
      message: results.length > 0 ? 
        `✅ ${tier} Penalty ${penaltyXP}XP diterapkan ke ${results.length}/${members.length} members!` : 
        `⚠️ Penalty gagal - cek XP member`
    };
    
  } catch (error) {
    console.error('💥 applyAttemptPenalty ERROR:', error);
    return { applied: false, error: error.message };
  }
};

/* ================= CHECK PENALTY STATUS ================= */
exports.checkAttemptPenalty = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const [pseudo, flowchart] = await Promise.all([
      WorkspaceAttempt.count({ where: { roomId, type: "pseudocode" } }),
      WorkspaceAttempt.count({ where: { roomId, type: "flowchart" } })
    ]);
    
    const total = pseudo + flowchart;
    let penaltyXP = 0;
    if (total > 10) penaltyXP = 25;
    else if (total > 5) penaltyXP = 10;
    else if (total > 3) penaltyXP = 5;
    
    const room = await DiscussionRoom.findByPk(roomId);
    const members = await UserMateriProgress.findAll({
      where: { materiId: room.materiId, roomId }
    });
    
    res.json({
      status: true,
      totalAttempts: total,
      pseudocode: pseudo,
      flowchart: flowchart,
      nextPenaltyXP: penaltyXP,
      membersXP: members.map(m => ({ userId: m.userId, xp: m.xp })),
      warning: total > 3 ? `⚠️ Next attempt: -${penaltyXP}XP per member!` : '✅ Safe zone'
    });
    
  } catch (error) {
    console.error('checkAttemptPenalty error:', error);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

module.exports = exports;