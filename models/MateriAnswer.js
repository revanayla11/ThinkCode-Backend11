const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const MateriAnswer = sequelize.define("MateriAnswer", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  materiId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  pseudocode: {
    type: DataTypes.TEXT
  },
  flowchart: {
    type: DataTypes.JSON
  }
}, {
  tableName: "materi_answers",
  timestamps: true
});

module.exports = MateriAnswer;