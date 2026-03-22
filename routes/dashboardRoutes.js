const express = require("express");
const router = express.Router();

const verifyToken = require("../middleware/verifyToken");
const dashboardController = require("../controllers/dashboardController");

const Materi = require("../models/Materi");
const User = require("../models/User");
const UserMateriProgress = require("../models/UserMateriProgress");
const DiscussionRoom = require("../models/DiscussionRoom");
const DiscussionMessage = require("../models/DiscussionMessage");
const bcrypt = require("bcryptjs");

router.get("/", verifyToken, dashboardController.getDashboard);
router.get("/teacher", verifyToken, async (req, res) => {
  const totalMateri = await Materi.count();
  const totalGame = 0;
  const totalSiswa = await User.count({ where: { role: "student" } });

  res.json({
    totalMateri,
    totalGame,
    totalSiswa
  });
});
router.get("/students", verifyToken, async (req, res) => {
  const students = await User.findAll({ where: { role: "student" } });
  res.json({ students });
});
router.post("/students", verifyToken, async (req, res) => {
  const { name, email, class: kelas, password } = req.body;

  const hash = await bcrypt.hash(password, 10);

  await User.create({
    name,
    email,
    class: kelas,
    password: hash,
    role: "student",
  });

  res.json({ message: "Siswa berhasil ditambahkan" });
});
router.delete("/student/delete/:id", verifyToken, async (req, res) => {
  await User.destroy({ where: { id: req.params.id } });
  res.json({ message: "Siswa berhasil dihapus" });
});

router.get("/student/detail/:id", verifyToken, async (req, res) => {
  const id = Number(req.params.id);

  const user = await User.findByPk(id, {
    attributes: ["id", "name", "email", "class", "xp"]
  });

  if (!user)
    return res.status(404).json({ message: "Siswa tidak ditemukan" });

  const totalMateri = await Materi.count();

  const selesai = await UserMateriProgress.count({
    where: { userId: id, progress: 100 }
  });

  const progressMateri =
    totalMateri === 0 ? 0 : Math.round((selesai / totalMateri) * 100);

  const group = await DiscussionRoom.findOne({
    include: [
      {
        model: DiscussionMessage,
        where: { userId: id },
        required: false
      }
    ]
  });

  const allUsers = await User.findAll({ order: [["xp", "DESC"]] });
  const rank = allUsers.findIndex(u => u.id === id) + 1;

  res.json({
    status: true,
    user,
    progressMateri,
    group,
    rank,
    totalGame: 0
  });
});

module.exports = router;