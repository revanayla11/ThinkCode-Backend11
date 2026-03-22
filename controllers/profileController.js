const User = require("../models/User");
const UserMateriProgress = require("../models/UserMateriProgress");
const UserBadge = require("../models/UserBadge");
const Badge = require("../models/Badge");
const Materi = require("../models/Materi");
const bcrypt = require("bcryptjs");

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // ===== USER =====
    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "class", "email", "xp"]
    });

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    // ===== MATERI PROGRESS =====
    const materiProgress = await UserMateriProgress.findAll({
      where: { userId }, // ✅ BENAR
      include: [{
        model: Materi,
        attributes: ["id", "title", "slug"]
      }]
    });

    // ===== ACHIEVEMENT / BADGE =====
    const badges = await UserBadge.findAll({
      where: { user_id: userId }, // ✅ FIX
      include: [{
        model: Badge,
        attributes: ["id", "badge_name", "icon", "description"]
      }]
    });

    res.json({
      user,
      statistik: {
        totalXp: user.xp || 0,
        totalMateri: materiProgress.length,
        totalBadge: badges.length
      },
      materi: materiProgress,
      achievements: badges
    });

  } catch (err) {
    console.error("PROFILE ERROR:", err);
    res.status(500).json({ message: "Gagal mengambil data profile" });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, email } = req.body;

    await User.update(
      { name, email },
      { where: { id: userId } }
    );

    res.json({ message: "Profil berhasil diperbarui" });

  } catch (err) {
    console.error("UPDATE PROFILE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.updatePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isOldPasswordValid) {
      return res.status(400).json({ message: "Password lama salah" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await User.update(
      { password: hashedNewPassword },
      { where: { id: userId } }
    );

    res.json({ message: "Password berhasil diganti" });

  } catch (err) {
    console.error("UPDATE PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};
