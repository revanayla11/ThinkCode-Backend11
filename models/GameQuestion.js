const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const GameQuestion = sequelize.define("GameQuestion", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  levelId: { type: DataTypes.INTEGER, allowNull: false },
  type: { type: DataTypes.STRING, allowNull: false }, 
  content: { type: DataTypes.TEXT, allowNull: false }, 
  meta: { type: DataTypes.TEXT, allowNull: true },
}, {
  tableName: "game_questions",
  timestamps: false
});

module.exports = GameQuestion;
