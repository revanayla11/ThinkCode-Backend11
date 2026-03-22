const User = require("../../models/User");
const bcrypt = require("bcryptjs");
const { Op } = require("sequelize");
const RoomMember = require("../../models/RoomMember");
const DiscussionRoom = require("../../models/DiscussionRoom");
const Materi = require("../../models/Materi");

exports.list = async (req, res) => {
  try {
    let { q = "", page = 1, limit = 12, class: kelas, isActive, role, } = req.query;
    page = parseInt(page); limit = parseInt(limit);
    const offset = (page - 1) * limit;

    const where = {};
    if(q) where[Op.or] = [{ name: { [Op.like]: `%${q}%` } }, { email: { [Op.like]: `%${q}%` } }];
    if(kelas) where.class = kelas;
    if (isActive !== undefined) {  
      if (isActive === "true" || isActive === "1") where.isActive = true;
      else if (isActive === "false" || isActive === "0") where.isActive = false;
    }

    if (role) where.role = role;

    const { rows: users, count: total } = await User.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      attributes: ["id","name","email","class","xp","role","isActive","createdAt"],
    });

    res.json({
      status: true,
      data: users,
      pagination: { page, limit, totalItems: total, totalPages: Math.ceil(total/limit) }
    });
  } catch (err) {
    console.error("ERROR getUsers:", err.message);   
    console.error(err);                               
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.detail = async (req, res) => {
  try {
    const u = await User.findByPk(req.params.id, { attributes: ["id","name","email","class","xp","role","isActive","createdAt"] });
    if(!u) return res.status(404).json({ status:false, message:"User tidak ditemukan" });
    res.json({ status:true, data:u });
  } catch(err){ console.error(err); res.status(500).json({ status:false, message:"Server error" }); }
};

exports.update = async (req,res)=>{
  try{
    const { name,email,class:kelas,xp,role,isActive } = req.body;
    await User.update({ name,email,class:kelas,xp,role,isActive },{ where:{id:req.params.id} });
    res.json({ status:true, message:"User diperbarui" });
  }catch(err){ console.error(err); res.status(500).json({ status:false, message:"Server error" }); }
};

exports.toggleActive = async (req,res)=>{
  try{
    const user = await User.findByPk(req.params.id);
    if(!user) return res.status(404).json({ status:false, message:"User tidak ditemukan" });
    const newActive = !user.isActive;  
    await User.update({ isActive: newActive },{ where:{id:req.params.id} });
    
    const updatedUser = await User.findByPk(req.params.id);
    res.json({ status:true, data: updatedUser, message:`User ${newActive?"diaktifkan":"dinonaktifkan"}` });
  }catch(err){ console.error(err); res.status(500).json({ status:false, message:"Server error" }); }
};

exports.resetPassword = async (req,res)=>{
  try{
    const hash = await bcrypt.hash("password123",10);
    await User.update({ password:hash },{ where:{id:req.params.id} });
    res.json({ status:true, message:"Password direset menjadi 'password123'" });
  }catch(err){ console.error(err); res.status(500).json({ status:false, message:"Server error" }); }
};

exports.remove = async (req,res)=>{
  try{
    await User.destroy({ where:{id:req.params.id} });
    res.json({ status:true, message:"User dihapus" });
  }catch(err){ console.error(err); res.status(500).json({ status:false, message:"Server error" }); }
};

exports.getStudentRooms = async (req, res) => {
  try {
    const userId = req.params.id;

    const rooms = await RoomMember.findAll({
      where: { user_id: userId },
      include: [
        {
          model: DiscussionRoom,
          as: "room",
          attributes: ["id", "title", "capacity", "isClosed"],
          include: [
            {
              model: Materi,
              as: "materi",
              attributes: ["title"],  
            },
          ],
        },
      ],
    });

    const formattedRooms = rooms.map((member) => ({
      materi: member.room?.materi?.title || "Tidak diketahui",  
      room_name: member.room?.title || "Tidak diketahui",
    }));

    res.json({
      status: true,
      data: formattedRooms,
    });
  } catch (err) {
    console.error("ERROR getStudentRooms:", err.message);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

exports.getStudentHistory = async (req, res) => {
  res.json({ status: true, data: [] });
};

exports.create = async (req, res) => {
  try {
    const { name, email, class: kelas, role } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        status: false,
        message: "Nama dan email wajib diisi",
      });
    }

    const exists = await User.findOne({ where: { email } });
    if (exists) {
      return res.status(400).json({
        status: false,
        message: "Email sudah terdaftar",
      });
    }

    const allowedRoles = ["student", "teacher", "admin"];
    const finalRole = allowedRoles.includes(role) ? role : "student";

    const hash = await bcrypt.hash("password123", 10);

    const newUser = await User.create({
      name,
      email,
      class: kelas,
      password: hash,
      role: finalRole,
      xp: 0,
      isActive: true,
    });

    res.json({
      status: true,
      message: `${finalRole} berhasil ditambahkan`,
      data: newUser,
    });

  } catch (err) {
    console.error("CREATE USER ERROR:", err);
    res.status(500).json({ status: false, message: "Server error" });
  }
};

