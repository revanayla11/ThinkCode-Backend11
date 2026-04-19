const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); 

const RoomTaskProgress = sequelize.define('RoomTaskProgress', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'discussion_rooms',
      key: 'id',
    },
  },
  taskId: {
    type: DataTypes.INTEGER, // 1-5 sesuai task
    allowNull: false,
  },
  done: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: "room_task_progress",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['roomId', 'taskId'], // Unik per room-task (shared)
    },
  ],
});

module.exports = RoomTaskProgress;