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

    // 1️⃣ Hitung clue used (pakai DiscussionClueLog)
    const usedClues = await DiscussionClueLog.count({
      where: { roomId }
    });

    // 2️⃣ Hitung total attempt (pseudocode + flowchart)
    const attempts = await WorkspaceAttempt.count({
      where: { roomId }
    });

    // 3️⃣ Cek apakah semua task selesai
    const tasks = await RoomTaskProgress.findAll({
      where: { roomId }
    });

    const allDone =
      tasks.length === 5 &&
      tasks.every(t => t.done);

    // 4️⃣ Hitung score
    let score = 100;

    score -= usedClues * 10;
    score -= attempts * 5;
    if (!allDone) score -= 20;

    if (score < 0) score = 0;

    res.json({
      score,
      usedClues,
      attempts,
      allDone
    });

  } catch (error) {
    console.error("Error getRoomPerformance:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/* ================= GET ROOMS ================= */
exports.getRooms = async (req, res) => {
  try {
    const materiId = req.params.materiId;

    if (!materiId)
      return res.status(400).json({
        status: false,
        message: "materiId diperlukan",
      });

    const rooms = await DiscussionRoom.findAll({
      where: { materiId },
      attributes: ["id", "materiId", "title", "capacity", "isClosed"],
    });

    const roomsWithCurrent = await Promise.all(
      rooms.map(async (room) => {
        const current = await UserMateriProgress.count({
          where: { roomId: room.id },
        });
        return {
          ...room.toJSON(),
          current,
        };
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

    if (!message || !message.trim())
      return res.status(400).json({
        status: false,
        message: "Pesan kosong",
      });

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

    const mini = await MateriSection.findOne({
      where: { materiId, type: "mini" },
    });

    if (!mini)
      return res.json({
        status: false,
        message: "Mini lesson tidak ditemukan",
      });

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
      return res.status(400).json({
        status: false,
        message: "materiId diperlukan",
      });
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
    res.status(500).json({
      status: false,
      message: "Server error",
    });
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

    // Validasi
    if (isNaN(roomId) || roomId <= 0) return res.status(400).json({ message: "roomId tidak valid" });
    if (isNaN(clueId) || clueId <= 0) return res.status(400).json({ message: "clueId tidak valid" });

    // Ambil room
    const room = await DiscussionRoom.findByPk(roomId, { transaction });
    if (!room) return res.status(404).json({ message: "Room tidak ditemukan" });
    if (!room.materiId) return res.status(400).json({ message: "Room tidak punya materiId" });

    // Ambil clue
    const clue = await Clue.findByPk(clueId, { transaction });
    if (!clue) return res.status(404).json({ message: "Clue tidak ditemukan" });

    // Cek sudah used
    const alreadyUsed = await DiscussionClueLog.findOne({ where: { roomId, clueId }, transaction });
    if (alreadyUsed) return res.status(400).json({ message: "Clue ini sudah digunakan di room ini" });

    // Ambil members dan sync XP dulu
    const members = await UserMateriProgress.findAll({
      where: { materiId: room.materiId, roomId },
      transaction,
    });

    console.log("Members found:", members.length, members.map(m => ({ id: m.userId, xp: m.xp })));

    if (!members.length) {
      await transaction.rollback();
      return res.status(400).json({ message: "Tidak ada anggota di room. Pastikan sudah join room dengan benar." });
    }

    const cost = Number(clue.cost || 0);
    // Cek dan potong XP dari kedua tabel
    for (const member of members) {
      // Sync XP dulu jika perlu (pastikan up-to-date dari Users)
      await exports.syncUserXp(member.userId, room.materiId, transaction);

      // Reload member untuk dapat XP terbaru
      await member.reload({ transaction });
      console.log(`Checking XP for user ${member.userId}: ${member.xp} >= ${cost}`);

      if (member.xp < cost) {
        await transaction.rollback();
        return res.status(400).json({
          message: `XP anggota ${member.userId} tidak mencukupi (diperlukan ${cost} XP). Dapatkan XP tambahan di halaman Mini Game.`,
        });
      }

      // Potong dari UserMateriProgress
      member.xp -= cost;
      await member.save({ transaction });

      // Potong dari Users juga
      await User.update(
        { xp: User.sequelize.literal(`xp - ${cost}`) },
        { where: { id: member.userId }, transaction }
      );
    }

    // Simpan log clue
    await DiscussionClueLog.create({ roomId, clueId, takenBy: userId }, { transaction });

    // Simpan chat history
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
      include: [
        { model: Clue },
        { model: User, attributes: ["name"] },
      ],
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

    // Sync XP dari Users ke UserMateriProgress
    await exports.syncUserXp(userId, materiId, transaction);

    let progress = await UserMateriProgress.findOne({
      where: { userId, materiId },
      transaction,
    });

    if (!progress) {
      progress = await UserMateriProgress.create({
        userId,
        materiId,
        xp: 0,  // Akan di-sync di atas
        completedSections: "[]",
        percent: 0,
        roomId: null,
      }, { transaction });
    }

    if (progress.roomId && progress.roomId !== parseInt(roomId)) {
      await transaction.rollback();
      return res.status(400).json({
        status: false,
        message: `Anda sudah join Room ${progress.roomId}. Tidak bisa join room lain.`,
      });
    }

    await progress.update({ roomId: parseInt(roomId) }, { transaction });

    const alreadyMember = await RoomMember.findOne({
      where: { room_id: roomId, user_id: userId },
      transaction,
    });

    if (!alreadyMember) {
      await RoomMember.create({
        room_id: roomId,
        user_id: userId,
      }, { transaction });
    }

    await transaction.commit();
    res.json({ status: true, message: "Berhasil join room", roomId });
  } catch (err) {
    await transaction.rollback();
    console.error("joinRoom:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= CAN USE CLUE ================= */
exports.canUseClue = async (req, res) => {
  try {
    const { roomId, clueId } = req.params;
    const userId = req.user.id;

    const room = await DiscussionRoom.findByPk(roomId);
    if (!room) return res.status(404).json({ status: false, message: "Room tidak ditemukan" });

    const clue = await Clue.findByPk(clueId);
    if (!clue) return res.status(404).json({ status: false, message: "Clue tidak ditemukan" });

    const members = await UserMateriProgress.findAll({
      where: { materiId: room.materiId, roomId },
    });

    const cost = clue.cost;
    let canUse = true;
    let message = "XP cukup untuk semua anggota.";
    for (const member of members) {
      if (member.xp < cost) {
        canUse = false;
        message = `XP anggota tidak cukup. Dapatkan XP di Game/Mini Game.`;
        break;
      }
    }

    res.json({ status: true, canUse, message });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= GET USER XP ================= */
exports.getUserXp = async (req, res) => {
  try {
    const { materiId } = req.params;
    const userId = req.user.id;

    const progress = await UserMateriProgress.findOne({
      where: { userId, materiId },
      attributes: ['xp'],
    });

    res.json({ status: true, xp: progress?.xp || 0 });
  } catch (err) {
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= SAVE PSEUDOCODE ================= */
exports.savePseudocode = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { pseudocode } = req.body;

    if (!pseudocode || !pseudocode.trim()) {
      return res.status(400).json({
        status: false,
        message: "Pseudocode tidak boleh kosong",
      });
    }

    const attemptCount = await WorkspaceAttempt.count({
      where: { roomId, type: "pseudocode" },
    });

    if (attemptCount >= 10) {
      return res.status(400).json({
        status: false,
        message: "Maksimal 10 attempt pseudocode tercapai.",
      });
    }

    await WorkspaceAttempt.create({
      roomId,
      type: "pseudocode",
      attemptNumber: attemptCount + 1,
      content: pseudocode,
    });

    let workspace = await Workspace.findOne({ where: { roomId } });

    if (workspace) {
      await workspace.update({ pseudocode });
    } else {
      await Workspace.create({
        roomId,
        pseudocode,
        flowchart: { conditions: [], elseInstruction: "" },
      });
    }

    // AUTO CHECKLIST TASK 3
    await RoomTaskProgress.upsert({
      roomId,
      taskId: 3,
      done: true,
    });

    res.json({
      status: true,
      message: `Pseudocode disimpan (Attempt ${attemptCount + 1}/10)`,
    });

  } catch (err) {
    console.error("savePseudocode:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= SAVE FLOWCHART ================= */
exports.saveFlowchart = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { flowchart } = req.body;

    const attemptCount = await WorkspaceAttempt.count({
      where: { roomId, type: "flowchart" },
    });

    if (attemptCount >= 10) {
      return res.status(400).json({
        status: false,
        message: "Maksimal 10 attempt flowchart tercapai.",
      });
    }

    await WorkspaceAttempt.create({
      roomId,
      type: "flowchart",
      attemptNumber: attemptCount + 1,
      content: JSON.stringify(flowchart),
    });

    let workspace = await Workspace.findOne({ where: { roomId } });

    if (workspace) {
      await workspace.update({ flowchart });
    } else {
      await Workspace.create({
        roomId,
        pseudocode: "",
        flowchart,
      });
    }

    // AUTO CHECKLIST TASK 4
    await RoomTaskProgress.upsert({
      roomId,
      taskId: 4,
      done: true,
    });

    res.json({
      status: true,
      message: `Flowchart disimpan (Attempt ${attemptCount + 1}/10)`,
    });

  } catch (err) {
    console.error("saveFlowchart:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= GET WORKSPACE ================= */
exports.getWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params;
    const workspace = await Workspace.findOne({ where: { roomId } });
    res.json({ status: true, data: workspace || { pseudocode: "", flowchart: { conditions: [], elseInstruction: "" } } });
  } catch (err) {
    console.error("getWorkspace:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

/* ================= GET TASK PROGRESS ================= */
exports.getTaskProgress = async (req, res) => {
  try {
    const { roomId } = req.params;
    const tasks = await RoomTaskProgress.findAll({ where: { roomId } });
    const taskMap = {};
    tasks.forEach(t => { taskMap[t.taskId] = t.done; });
    // Default false jika belum ada
    for (let i = 1; i <= 5; i++) {
      if (!taskMap[i]) taskMap[i] = false;
    }
    res.json({ status: true, data: taskMap });
  } catch (err) {
    console.error("getTaskProgress:", err);
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

    res.json({ status: true, message: "Task updated." });
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

/* ================= GET WORKSPACE ATTEMPTS (FOR ADMIN) ================= */
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

exports.uploadJawaban = async (req, res) => {
  try {
    const { roomId } = req.params;

    const tasks = await RoomTaskProgress.findAll({
      where: { roomId }
    });

    const allDone =
      tasks.length === 5 &&
      tasks.every(t => t.done);

    if (!allDone) {
      return res.status(400).json({
        status: false,
        message: "Selesaikan semua task sebelum upload jawaban."
      });
    }

    // lanjut proses upload file di sini

    res.json({
      status: true,
      message: "Upload berhasil."
    });

  } catch (err) {
    res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};

exports.getSubmissionStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    // Asumsi ada model Submission atau flag di Workspace/Room
    // Jika belum ada, default false (belum submit)
    const submitted = false;  // Ganti dengan query nyata jika ada model Submission
    res.json({ submitted });
  } catch (err) {
    console.error("getSubmissionStatus:", err);
    res.status(500).json({ message: "Server error" });
  }
};

exports.validateWorkspace = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.user.id;

    console.log(`🔍 Validasi workspace room ${roomId} oleh user ${userId}`);

    // 1. Cek workspace
    const workspace = await Workspace.findOne({ where: { roomId: parseInt(roomId) } });
    if (!workspace) {
      return res.status(400).json({ 
        valid: false, 
        message: "Belum ada workspace yang disimpan!" 
      });
    }

    // 2. Ambil room & materiId
    const room = await DiscussionRoom.findByPk(roomId);
    if (!room) {
      return res.status(404).json({ valid: false, message: "Room tidak ditemukan" });
    }

    // 3. Ambil jawaban resmi
    const officialAnswer = await MateriAnswer.findOne({ where: { materiId: room.materiId } });
    if (!officialAnswer || !officialAnswer.pseudocode) {
      return res.status(400).json({ 
        valid: false, 
        message: "Admin belum set jawaban resmi!" 
      });
    }

    // 4. NORMALIZE PSEUDOCODE
    const normalizeText = (text) => (text || "").toString().trim().toLowerCase().replace(/\s+/g, ' ');
    const studentPseudo = normalizeText(workspace.pseudocode);
    const officialPseudo = normalizeText(officialAnswer.pseudocode);
    const pseudocodeMatch = studentPseudo === officialPseudo;

    // 5. VALIDASI FLOWCHART - ✅ FIXED SCOPE
    let flowchartMatch = true;
    let flowchartDetails = {};
    let studentConditions = []; // ✅ Deklarasi di luar try
    let officialConditions = [];

    try {
      // Parse flowchart dengan safe parsing
      const parseFlowchart = (flowData) => {
        try {
          return typeof flowData === 'string' 
            ? JSON.parse(flowData || '{}')
            : (flowData || { conditions: [], elseInstruction: '' });
        } catch {
          return { conditions: [], elseInstruction: '' };
        }
      };

      const studentFlowchart = parseFlowchart(workspace.flowchart);
      const officialFlowchart = parseFlowchart(officialAnswer.flowchart);

      // ✅ Sekarang aman - sudah dideklarasi di atas
      studentConditions = Array.isArray(studentFlowchart.conditions) ? studentFlowchart.conditions : [];
      officialConditions = Array.isArray(officialFlowchart.conditions) ? officialFlowchart.conditions : [];
      
      flowchartDetails = {
        conditionsCountMatch: studentConditions.length === officialConditions.length,
        conditions: [],
        elseMatch: normalizeText(studentFlowchart.elseInstruction) === normalizeText(officialFlowchart.elseInstruction)
      };

      if (studentConditions.length !== officialConditions.length) {
        flowchartMatch = false;
      } else {
        for (let i = 0; i < studentConditions.length; i++) {
          const studentCond = normalizeText(studentConditions[i]?.condition || '');
          const officialCond = normalizeText(officialConditions[i]?.condition || '');
          const studentYes = normalizeText(studentConditions[i]?.yes || '');
          const officialYes = normalizeText(officialConditions[i]?.yes || '');

          const condMatch = {
            index: i + 1,
            conditionMatch: studentCond === officialCond,
            yesMatch: studentYes === officialYes
          };

          flowchartDetails.conditions.push(condMatch);
          
          if (!condMatch.conditionMatch || !condMatch.yesMatch) {
            flowchartMatch = false;
          }
        }
      }
    } catch (parseError) {
      flowchartMatch = false;
      console.error("Flowchart parse error:", parseError);
      flowchartDetails = { error: "Format flowchart tidak valid" };
    }

    const isValid = pseudocodeMatch && flowchartMatch;

    // ✅ Sekarang studentConditions aman dipakai
    console.log(`✅ Validasi selesai: ${isValid ? 'BENAR' : 'SALAH'}`, {
      pseudocodeMatch,
      flowchartMatch,
      studentConditionsCount: studentConditions.length,
      officialConditionsCount: officialConditions.length
    });

    res.json({
      valid: isValid,
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
    console.error("❌ Validasi workspace FULL ERROR:", error);
    res.status(500).json({ 
      valid: false, 
      message: `Server error: ${error.message}` 
    });
  }
};