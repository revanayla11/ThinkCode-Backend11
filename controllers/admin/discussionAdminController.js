const db = require("../../models");
const sequelize = db.sequelize || require("../../config/db");
const MAX_CLUE = 3;
const Workspace = require("../../models/Workspace");
const WorkspaceAttempt = require("../../models/WorkspaceAttempt");
const DiscussionClueLog = require("../../models/DiscussionClueLog");
const MateriAnswer = require("../../models/MateriAnswer");

exports.listMateri = async (req, res) => {
  try {
    const materi = await sequelize.query(
      `SELECT id, title, description FROM materi ORDER BY id ASC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    return res.json({ status: true, data: materi });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.listRoomsByMateri = async (req, res) => {
  try {
    const materiId = req.params.materiId;

    const rooms = await sequelize.query(
      `SELECT id, materi_id, room_name, max_members, 
              IFNULL(is_closed,0) AS is_closed 
       FROM discussion_rooms 
       WHERE materi_id = ? 
       ORDER BY id ASC`,
      {
        replacements: [materiId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    return res.json({ status: true, data: rooms });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.roomMembers = async (req, res) => {
  try {
    const roomId = req.params.roomId;

    const members = await sequelize.query(
      `SELECT rm.id, rm.user_id, u.name
       FROM room_members rm
       LEFT JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = ?`,
      { replacements: [roomId], type: sequelize.QueryTypes.SELECT }
    );

    return res.json({ status: true, data: members });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.roomClues = async (req, res) => {
  try {
    const roomId = req.params.roomId;

    const rows = await sequelize.query(
      `SELECT COUNT(*) AS used FROM discussion_messages WHERE roomId = ? AND message = '[REQUEST_CLUE]'`,
      { replacements: [roomId], type: sequelize.QueryTypes.SELECT }
    );

    return res.json({ status: true, data: { used: rows[0].used, max: 5 } });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.roomDetail = async (req, res) => {
  try {
    const roomId = req.params.roomId;

    const roomRows = await sequelize.query(
      `SELECT id, materi_id, room_name, max_members, IFNULL(is_closed,0) AS is_closed
       FROM discussion_rooms
       WHERE id = ?
       LIMIT 1`,
      { replacements: [roomId], type: sequelize.QueryTypes.SELECT }
    );

    const room = roomRows[0];
    if (!room) return res.status(404).json({ status: false, message: "Room not found" });

    const messages = await sequelize.query(
      `SELECT dm.id, dm.userId AS user_id, u.name AS sender_name, dm.message, dm.createdAt AS timestamp
       FROM discussion_messages dm
       LEFT JOIN users u ON u.id = dm.userId
       WHERE dm.roomId = ?
       ORDER BY dm.createdAt ASC
       LIMIT 1000`,
      { replacements: [roomId], type: sequelize.QueryTypes.SELECT }
    );

    // Perbaiki hitungan clue: gunakan DiscussionClueLog.count
    const used = await DiscussionClueLog.count({ where: { roomId } });
    console.log(`DEBUG: Clue used for room ${roomId}: ${used}`); // Tambah log untuk debug
    const maxClue = 3; // Sesuaikan dengan siswa

    return res.json({
      status: true,
      data: {
        room,
        messages,
        clue: { used, max: maxClue }
      }
    });

  } catch (err) {
    console.error("roomDetail error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.toggleRoom = async (req, res) => {
  try {
    const id = req.params.id;

    const [rows] = await sequelize.query(
      `SELECT id, IFNULL(is_closed,0) AS is_closed FROM discussion_rooms WHERE id = ? LIMIT 1`,
      { replacements: [id], type: sequelize.QueryTypes.SELECT }
    );

    const room = Array.isArray(rows) ? rows[0] : rows;
    if (!room) return res.status(404).json({ status: false, message: "Room not found" });

    const newStatus = room.is_closed ? 0 : 1;

    await sequelize.query(
      `UPDATE discussion_rooms SET is_closed = ? WHERE id = ?`,
      { replacements: [newStatus, id], type: sequelize.QueryTypes.UPDATE }
    );

    return res.json({ status: true, message: `Room ${newStatus ? "ditutup" : "dibuka"}`, isClosed: !!newStatus });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.listRooms = async (req, res) => {
  try {
    const rooms = await sequelize.query(
      `SELECT id, materi_id, room_name, max_members, IFNULL(is_closed,0) AS is_closed
       FROM discussion_rooms
       ORDER BY id ASC`,
      { type: sequelize.QueryTypes.SELECT }
    );

    return res.json({ status: true, data: rooms });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.createRoom = async (req, res) => {
  try {
    const { materiId, title, capacity, meta } = req.body;
    const room = await DiscussionRoom.create({
      materiId,
      title,
      capacity,
      meta
    });

    res.json({ status: true, data: room });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.updateRoom = async (req, res) => {
  try {
    await DiscussionRoom.update(req.body, {
      where: { id: req.params.id }
    });

    res.json({ status: true, message: "Room updated" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.deleteRoom = async (req, res) => {
  try {
    await DiscussionRoom.destroy({
      where: { id: req.params.id }
    });

    res.json({ status: true, message: "Room deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.workspaceLatest = async (req, res) => {
  try {
    console.log("Fetching workspace for roomId:", req.params.roomId);
    const workspace = await Workspace.findOne({
      where: { roomId: req.params.roomId }
    });
    console.log("Workspace data found:", workspace);
    return res.json({ status: true, data: workspace });
  } catch (err) {
    console.error("workspaceLatest error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.workspaceAttempts = async (req, res) => {
  try {
    console.log("Fetching attempts for roomId:", req.params.roomId);
    const attempts = await WorkspaceAttempt.findAll({
      where: { roomId: req.params.roomId },
      order: [["type", "ASC"], ["attemptNumber", "ASC"]]
    });
    console.log("Attempts data found:", attempts.length, "items");
    return res.json({ status: true, data: attempts });
  } catch (err) {
    console.error("workspaceAttempts error:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.saveMateriAnswer = async (req, res) => {
  try {

    const { materiId, pseudocode, flowchart } = req.body;

    let answer = await MateriAnswer.findOne({
      where: { materiId }
    });

    if (answer) {

      await answer.update({
        pseudocode,
        flowchart
      });

    } else {

      answer = await MateriAnswer.create({
        materiId,
        pseudocode,
        flowchart
      });

    }

    return res.json({ status: true, data: answer });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};

exports.getMateriAnswer = async (req, res) => {
  try {

    const roomId = req.params.roomId;

    // ambil materi_id dari room
    const room = await sequelize.query(
      `SELECT materi_id FROM discussion_rooms WHERE id = ? LIMIT 1`,
      {
        replacements: [roomId],
        type: sequelize.QueryTypes.SELECT
      }
    );

    if (!room.length) {
      return res.status(404).json({ status: false, message: "Room not found" });
    }

    const materiId = room[0].materi_id;

    // ambil jawaban materi
    const answer = await MateriAnswer.findOne({
      where: { materiId }
    });

    return res.json({ status: true, data: answer });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false });
  }
};