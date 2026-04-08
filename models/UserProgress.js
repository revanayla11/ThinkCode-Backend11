const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserProgress = sequelize.define("UserProgress", {
  userId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: 'users', key: 'id' }
  },
  levelId: { 
    type: DataTypes.INTEGER, 
    allowNull: false,
    references: { model: 'game_levels', key: 'id' }
  },
  xp: { type: DataTypes.INTEGER, defaultValue: 0 },
  stars: { type: DataTypes.INTEGER, defaultValue: 0 },
  completed: { type: DataTypes.BOOLEAN, defaultValue: false },
  score: { 
    type: DataTypes.INTEGER, 
    defaultValue: 0,
    validate: { min: 0, max: 100 }  // ← BARU! Buat unlock logic
  },
      createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      onUpdate: DataTypes.NOW
    }
}, {
  tableName: "user_progress",
  timestamps: false,
  indexes: [
    { unique: true, fields: ['userId', 'levelId'] }
  ]
});

module.exports = UserProgress;