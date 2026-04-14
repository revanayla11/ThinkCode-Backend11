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

    const workspace = await Workspace.findOne({
      where: { roomId }
    });

    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });

    const taskMap = {};
    tasks.forEach(t => { taskMap[t.taskId] = t.done; });

    for (let i = 1; i <= 5; i++) {
      if (!taskMap[i]) taskMap[i] = false;
    }

    res.json({
      status: true,
      data: {
        pseudocode: workspace?.pseudocode || "",
        flowchart: workspace?.flowchart || { conditions: [], elseInstruction: "" },
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

/* ================= SAVE PSEUDOCODE ================= */
/* ================= SAVE PSEUDOCODE - UNLIMITED + XP PENALTY ================= */
exports.savePseudocode = async (req, res) => {
  const transaction = await Workspace.sequelize.transaction();
  try {
    const roomId = parseInt(req.params.roomId);
    const { pseudocode } = req.body;
    const userId = req.user.id;

    console.log(`💾 savePseudocode room ${roomId}`);

    if (!pseudocode?.trim()) {
      return res.status(400).json({ status: false, message: "Pseudocode kosong" });
    }

    // Hitung attempts
    const attemptCount = await WorkspaceAttempt.count({
      where: { roomId, type: "pseudocode" }
    });

    // 🔥 NEW ATTEMPT
    await WorkspaceAttempt.create({
      roomId,
      type: "pseudocode",
      attemptNumber: attemptCount + 1,
      content: pseudocode,
      userId  // Track siapa yang save
    });

    // XP PENALTY - mulai attempt 6 (-10 XP per anggota)
    if (attemptCount + 1 > 5) {
      const penalty = 10;
      const room = await DiscussionRoom.findByPk(roomId, { transaction });
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
      
      console.log(`⚠️ Pseudocode penalty: -${penalty}XP x${members.length} members (attempt ${attemptCount + 1})`);
    }

    // Save workspace
    await Workspace.upsert({
      roomId,
      pseudocode: pseudocode.trim()
    }, { transaction });

    await RoomTaskProgress.upsert({ roomId, taskId: 3, done: true }, { transaction });

    await transaction.commit();
    
    res.json({ 
      status: true, 
      attempt: attemptCount + 1,
      penalty: attemptCount + 1 > 5 ? 10 : 0,
      message: `Saved! Attempt ${attemptCount + 1}${attemptCount + 1 > 5 ? ' (-10XP)' : ''}`
    });

  } catch (err) {
    await transaction.rollback();
    console.error("savePseudocode ERROR:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};

/* ================= SAVE FLOWCHART - UNLIMITED + XP PENALTY ================= */
/* ================= SAVE FLOWCHART - PERMANENT FIX ================= */
exports.saveFlowchart = async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    let { flowchart } = req.body;

    console.log(`🔧 saveFlowchart room ${roomId}:`, typeof flowchart);

    // 🔥 PERMANENT FIX: Handle string/object
    if (typeof flowchart === 'string') {
      flowchart = JSON.parse(flowchart);
    }

    // Validasi minimal
    if (!flowchart || !Array.isArray(flowchart.conditions) || flowchart.conditions.length === 0) {
      return res.status(400).json({ 
        status: false, 
        message: "Flowchart harus punya minimal 1 kondisi" 
      });
    }

    // 🔥 UNLIMITED ATTEMPTS - HAPUS LIMIT
    const attemptCount = await WorkspaceAttempt.count({
      where: { roomId, type: "flowchart" }
    });
    
    // Simpan attempt (no limit)
    await WorkspaceAttempt.create({
      roomId,
      type: "flowchart",
      attemptNumber: attemptCount + 1,
      content: JSON.stringify(flowchart)
    });

    // 🔥 CRITICAL: SAVE AS JSON STRING ke DB
    await Workspace.upsert({
      roomId,
      flowchart: JSON.stringify(flowchart)  // ✅ STRING FORMAT
    });

    await RoomTaskProgress.upsert({ 
      roomId, 
      taskId: 4, 
      done: true 
    });

    console.log(`✅ Flowchart SAVED room ${roomId}: ${flowchart.conditions.length} conditions`);
    res.json({ 
      status: true, 
      message: `Flowchart tersimpan! (${flowchart.conditions.length} kondisi)`
    });

  } catch (err) {
    console.error("saveFlowchart ERROR:", err);
    res.status(500).json({ 
      status: false, 
      message: err.message 
    });
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

exports.validateWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params;

    const workspace = await Workspace.findOne({
      where: { roomId: parseInt(roomId) }
    });

    if (!workspace) {
      return res.json({
        valid: false,
        score: 0,
        message: "Workspace belum ada"
      });
    }

    const room = await DiscussionRoom.findByPk(roomId);

    const answer = await MateriAnswer.findOne({
      where: { materiId: room.materiId }
    });

    const normalize = (text) =>
      text
        ?.toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/[^a-z0-9<>=! ]/g, "")
        .trim();

    // 🔥 PSEUDOCODE
    let pseudoScore = 0;
    let pseudoMatch = false;

    if (workspace.pseudocode && answer?.pseudocode) {
      const userPseudo = normalize(workspace.pseudocode);
      const correctPseudo = normalize(answer.pseudocode);

      const similarity =
        userPseudo === correctPseudo
          ? 100
          : userPseudo.includes(correctPseudo)
          ? 80
          : 50;

      pseudoScore = similarity >= 80 ? 50 : 0;
      pseudoMatch = similarity >= 80;
    }

    // 🔥 FLOWCHART
    let flowScore = 0;
    let flowMatch = false;

    try {
      const userFlow =
        typeof workspace.flowchart === "string"
          ? JSON.parse(workspace.flowchart)
          : workspace.flowchart;

      const correctFlow = answer?.flowchart;

      if (userFlow && correctFlow) {
        const userConditions = userFlow.conditions?.length || 0;
        const correctConditions = correctFlow.conditions?.length || 0;

        if (userConditions === correctConditions) {
          flowScore = 50;
          flowMatch = true;
        }
      }
    } catch (err) {
      console.log("Flow error:", err.message);
    }

    const totalScore = pseudoScore + flowScore;

    res.json({
      valid: totalScore >= 90,
      score: totalScore,
      details: {
        pseudocodeMatch: pseudoMatch,
        flowchartMatch: flowMatch
      }
    });

  } catch (error) {
    console.error("validateWorkspace:", error);
    res.status(500).json({ valid: false, score: 0 });
  }
};

// 🔥 DEBUG ENDPOINT - Tambah ini
exports.debugRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    const [workspace, room] = await Promise.all([
      Workspace.findOne({ where: { roomId: parseInt(roomId) } }),
      DiscussionRoom.findByPk(roomId)
    ]);
    
    res.json({
      roomId,
      roomExists: !!room,
      roomMateriId: room?.materiId,
      workspaceExists: !!workspace,
      hasPseudo: !!workspace?.pseudocode?.trim(),
      hasFlow: !!workspace?.flowchart,
      flowParsed: workspace?.flowchart ? 
        (typeof workspace.flowchart === 'string' ? 'JSON string OK' : 'Object OK') : 'No flowchart'
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
        write("___BLANK_3___", ___BLANK_4___, " Angka adalah Positif")
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

module.exports = exports;