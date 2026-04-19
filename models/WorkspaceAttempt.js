const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const WorkspaceAttempt = sequelize.define('WorkspaceAttempt', {
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
  type: {
    type: DataTypes.ENUM('pseudocode', 'flowchart'),
    allowNull: false,
  },
  attemptNumber: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: "workspace_attempt", timestamps: true,
});

module.exports = WorkspaceAttempt;