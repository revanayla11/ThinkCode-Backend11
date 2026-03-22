const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.register = async (req, res) => {
  try {
    const { name, email, class: kelas, password, role } = req.body;

    const check = await User.findOne({ where: { email } });
    if (check) {
      return res.json({ status: false, message: "Email sudah terdaftar" });
    }

    const hash = await bcrypt.hash(password, 10);

    await User.create({
      name,
      email,
      class: kelas,
      password: hash,
      role: role,
    });

    return res.json({ status: true, message: "Registrasi berhasil" });
  } catch (err) {
    console.log("REGISTER ERROR:", err);
    return res.status(500).json({ status: false, message: "Server error" });
  }
};


exports.login = async (req, res) => {
  try {
    console.log("LOGIN BODY:", req.body);
    const { email, password } = req.body;

    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ status: false, message: "User tidak ditemukan" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ status: false, message: "Password salah" });
    }

    let firstLoginReward = false;
    if (user.role === "student"){
    if (user.xp === 0) {
      user.xp = 50;
      await user.save();
      firstLoginReward = true;
    }
  }

    const token = jwt.sign(
  { id: user.id, role: user.role },
  process.env.JWT_SECRET || "secretjwt",
  { expiresIn: "7d" }
);


    return res.json({
      status: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        xp: user.xp,
        class: user.class,
        role: user.role   
      },
      firstLoginReward
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getMe = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "email", "class", "xp", "role"]
    });

    if (!user)
      return res.status(404).json({ status: false, message: "User tidak ditemukan" });

    return res.json({
      status: true,
      user
    });

  } catch (err) {
    console.log("GET ME ERROR:", err);
    return res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};


exports.forgotPassword = async (req, res) => {
  return res.json({
    status: true,
    message: "Fitur lupa password belum dibuat."
  });
};


exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { name, email, class: kelas } = req.body;

    await User.update(
      { name, email, class: kelas },
      { where: { id: userId } }
    );

    return res.json({
      status: true,
      message: "Profil berhasil diperbarui"
    });

  } catch (err) {
    console.log("UPDATE PROFILE ERROR:", err);
    return res.status(500).json({
      status: false,
      message: "Server error"
    });
  }
};

exports.uploadPhoto = async (req, res) => {
  try {
    const userId = req.user.id; 

    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file yang diupload" });
    }

    const photoName = req.file.filename;

    await User.update(
      { photo: photoName },
      { where: { id: userId } }
    );

    res.json({
      message: "Foto profil berhasil diupload",
      photo: photoName,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Gagal upload foto" });
  }
};


exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    const user = await User.findByPk(userId);

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match)
      return res.json({ status: false, message: "Password lama salah." });

    const hash = await bcrypt.hash(newPassword, 10);

    await User.update(
      { password: hash },
      { where: { id: userId } }
    );

    res.json({ status: true, message: "Password berhasil diubah." });

  } catch (err) {
    console.log("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "xp", "class"]
    });

    if (!user) {
      return res.status(404).json({ status: false, message: "User tidak ditemukan" });
    }

    return res.json({
      status: true,
      progress: {
        xp: user.xp,
        level: Math.floor(user.xp / 100), 
      }
    });

  } catch (err) {
    console.log("GET PROGRESS ERROR:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};
