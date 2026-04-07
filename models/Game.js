// models/Game.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Game = sequelize.define('Game', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    title: DataTypes.STRING,
    type: DataTypes.ENUM('quiz', 'flashcard', 'sheriff', 'tts'),
    description: DataTypes.TEXT,
    xp_reward: DataTypes.INTEGER,
    badge_name: DataTypes.STRING,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  return Game;
};