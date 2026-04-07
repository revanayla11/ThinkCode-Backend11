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

    const usedClues = await DiscussionClueLog.count({ where: { roomId } });
    const pseudoAttempts = await WorkspaceAttempt.count({ where: { roomId, type: "pseudocode" } });
    const flowchartAttempts = await WorkspaceAttempt.count({ where: { roomId, type: "flowchart" } });
    const totalAttempts = pseudoAttempts + flowchartAttempts;

    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    const allDone = tasks.length === 5 && tasks.every(t => t.done);

    // ✅ FIXED: MULAI DARI 100%, TASK TIDAK LAGI -20%
    let score = 100;
    score -= usedClues * 10; // Clue penalty
    const attemptsAbove3 = Math.max(0, totalAttempts - 3);
    score -= attemptsAbove3 * 5; // Attempt penalty
    
    // ✅ TASK BONUS (+10% jika semua selesai)
    if (allDone) score += 10;
    
    if (score > 100) score = 100;
    if (score < 0) score = 0;

    console.log(`📊 Performance room ${roomId}:`, { usedClues, totalAttempts, allDone, score });

    res.json({
      score: Math.round(score),
      usedClues,
      pseudoAttempts,
      flowchartAttempts,
      totalAttempts,
      allDone,
      breakdown: {
        cluePenalty: usedClues * 10,
        attemptPenalty: attemptsAbove3 * 5,
        taskBonus: allDone ? 10 : 0
      }
    });
  } catch (error) {
    console.error("Error getRoomPerformance:", error);
    res.status(500).json({ message: "Server error", score: 100 }); // ✅ DEFAULT 100%
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
exports.savePseudocode = async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { pseudocode } = req.body;

    if (!pseudocode || !pseudocode.trim()) {
      return res.status(400).json({ status: false, message: "Pseudocode kosong" });
    }

    const attemptCount = await WorkspaceAttempt.count({
      where: { roomId, type: "pseudocode" }
    });

    if (attemptCount >= 10) {
      return res.status(400).json({ message: "Max 10 attempt" });
    }

    await WorkspaceAttempt.create({
      roomId,
      type: "pseudocode",
      attemptNumber: attemptCount + 1,
      content: pseudocode,
    });

    // 🔥 UPSERT (ANTI DUPLIKAT)
    await Workspace.upsert({
      roomId,
      pseudocode,
    });

    await RoomTaskProgress.upsert({ roomId, taskId: 3, done: true });

    res.json({ status: true });

  } catch (err) {
    console.error("savePseudo:", err);
    res.status(500).json({ status: false });
  }
};

/* ================= SAVE FLOWCHART ================= */
exports.saveFlowchart = async (req, res) => {
  try {
    const roomId = parseInt(req.params.roomId);
    const { flowchart } = req.body;

    const attemptCount = await WorkspaceAttempt.count({
      where: { roomId, type: "flowchart" }
    });

    if (attemptCount >= 10) {
      return res.status(400).json({ message: "Max attempt flowchart" });
    }

    await WorkspaceAttempt.create({
      roomId,
      type: "flowchart",
      attemptNumber: attemptCount + 1,
      content: JSON.stringify(flowchart),
    });

    await Workspace.upsert({
      roomId,
      flowchart,
    });

    await RoomTaskProgress.upsert({ roomId, taskId: 4, done: true });

    res.json({ status: true });

  } catch (err) {
    console.error("saveFlow:", err);
    res.status(500).json({ status: false });
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
    if (!room) return res.status(404).json({ status: false, message: "Room not found" });

    const materiId = room.materiId.toString();
    
    // ✅ NEW TEMPLATE SESUAI REQUEST
    const template = `DEKLARASI 
    ___BLANK_0___ : integer

ALGORITMA 
    read(___BLANK_1___)
    
    IF (___BLANK_2___) THEN 
        write("___BLANK_3___")
    ENDIF 

END`;

    const blanks = [
      { hint: "Nama variabel", expected: "angka" },
      { hint: "Variabel input", expected: "angka" },
      { hint: "Kondisi", expected: "angka > 0" },
      { hint: "Pesan output", expected: "Angka positif" }
    ];

    res.json({
      status: true,
      data: {
        template,
        blanks,
        expectedFull: template
          .replace('___BLANK_0___', 'angka')
          .replace('___BLANK_1___', 'angka')
          .replace('___BLANK_2___', 'angka > 0')
          .replace('___BLANK_3___', 'Angka positif'),
        materiType: "if-simple-blanks",
        totalBlanks: 4,
        instruction: "Isi 4 blank untuk melengkapi algoritma IF sederhana!"
      }
    });
  } catch (error) {
    console.error("getPseudocodeTemplate error:", error);
    res.status(500).json({ 
      status: false, 
      message: "Gagal load template",
      data: { 
        template: `DEKLARASI 
    ___BLANK_0___ : integer

ALGORITMA 
    read(___BLANK_1___)
    IF (___BLANK_2___) THEN 
        write("___BLANK_3___")
    ENDIF 
END`,
        blanks: [
          { hint: "Nama variabel" },
          { hint: "Variabel input" },
          { hint: "Kondisi" },
          { hint: "Pesan output" }
        ]
      }
    });
  }
};

/* ================= VALIDATE WORKSPACE (VS GURU JAWABAN) ================= */
exports.validateWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params;
    const workspace = await Workspace.findOne({ where: { roomId: parseInt(roomId) } });
    if (!workspace) return res.status(400).json({ valid: false, message: "Belum ada workspace!" });

    const room = await DiscussionRoom.findByPk(roomId);
    const officialAnswer = await MateriAnswer.findOne({ where: { materiId: room.materiId } });
    if (!officialAnswer) return res.status(400).json({ valid: false, message: "Guru belum upload jawaban!" });

    const normalizeText = (text) => (text || "").toString().trim().toLowerCase().replace(/\s+/g, ' ');
    
    // PSEUDOCODE VALIDATION
    const studentPseudo = normalizeText(workspace.pseudocode);
    const officialPseudo = normalizeText(officialAnswer.pseudocode);
    const pseudocodeMatch = studentPseudo === officialPseudo;

    // FLOWCHART VALIDATION
    const parseFlowchart = (flowData) => {
      try {
        return typeof flowData === 'string' ? JSON.parse(flowData || '{}') : flowData || { conditions: [], elseInstruction: '' };
      } catch {
        return { conditions: [], elseInstruction: '' };
      }
    };

    const studentFlow = parseFlowchart(workspace.flowchart);
    const officialFlow = parseFlowchart(officialAnswer.flowchart);
    
    let flowchartMatch = true;
    let flowchartDetails = {
      conditionsCountMatch: studentFlow.conditions.length === officialFlow.conditions.length,
      conditions: [],
      elseMatch: normalizeText(studentFlow.elseInstruction) === normalizeText(officialFlow.elseInstruction)
    };

    const studentConditions = Array.isArray(studentFlow.conditions) ? studentFlow.conditions : [];
    const officialConditions = Array.isArray(officialFlow.conditions) ? officialFlow.conditions : [];

    if (studentConditions.length !== officialConditions.length) {
      flowchartMatch = false;
    } else {
      for (let i = 0; i < studentConditions.length; i++) {
        const sCond = normalizeText(studentConditions[i]?.condition || '');
        const oCond = normalizeText(officialConditions[i]?.condition || '');
        const sYes = normalizeText(studentConditions[i]?.yes || '');
        const oYes = normalizeText(officialConditions[i]?.yes || '');

        const condMatch = {
          index: i + 1,
          conditionMatch: sCond === oCond,
          yesMatch: sYes === oYes
        };

        flowchartDetails.conditions.push(condMatch);
        if (!condMatch.conditionMatch || !condMatch.yesMatch) {
          flowchartMatch = false;
        }
      }
    }

    const isValid = pseudocodeMatch && flowchartMatch;

    res.json({
      valid: isValid,
      score: isValid ? 100 : Math.round((pseudocodeMatch ? 50 : 0) + (flowchartMatch ? 50 : 0)),
      details: {
        pseudocodeMatch,
        flowchartMatch,
        flowchartDetails,
        pseudocode: {
          student: workspace.pseudocode?.trim(),
          official: officialAnswer.pseudocode?.trim(),
          match: pseudocodeMatch
        }
      }
    });
  } catch (error) {
    console.error("validateWorkspace error:", error);
    res.status(500).json({ valid: false, message: "Server error" });
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

module.exports = exports;