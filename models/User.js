const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    class: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    xp: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    hearts: {  // ← TAMBAH INI!
      type: DataTypes.INTEGER,
      defaultValue: 5,
      validate: { min: 0, max: 5 }
    },
    individual_rank: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    group_rank: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    role: {
      type: DataTypes.ENUM("admin", "teacher", "student"),
      allowNull: false,
      defaultValue: "student",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    tableName: "users",
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  }
);

module.exports = User;