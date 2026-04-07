const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Materi = require("./Materi"); 
const Badge = require("./Badge");

const GameLevel = sequelize.define(
  "GameLevel",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING, allowNull: false },
    levelNumber: { type: DataTypes.INTEGER, allowNull: false },
    totalQuestions: { type: DataTypes.INTEGER, defaultValue: 10 },
    reward_xp: { type: DataTypes.INTEGER, defaultValue: 0 },
    reward_badge_id: { type: DataTypes.INTEGER, allowNull: true },
    materi_id: { type: DataTypes.INTEGER, allowNull: false }, 

  },
  {
    tableName: "game_levels",
    timestamps: false,
  }
);

GameLevel.belongsTo(Materi, { foreignKey: "materi_id" });
GameLevel.belongsTo(Badge, { foreignKey: "reward_badge_id"});

module.exports = GameLevel;
