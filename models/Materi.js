const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const Materi = sequelize.define(
  "Materi",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    createdAt: {
  type: DataTypes.DATE,
  allowNull: true // ✅ penting
},
updatedAt: {
  type: DataTypes.DATE,
  allowNull: true
},
  },
  {
    tableName: "materi",
    indexes: [
      {
        unique: true,
        fields: ["slug"],
      },
    ],
  }
);

module.exports = Materi;
