const { DataTypes } = require('sequelize');
const sequelize = require('../config/db'); // Sesuaikan path

const Workspace = sequelize.define('Workspace', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  roomId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'discussion_rooms',
      key: 'id',
    },
  },
  pseudocode: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  flowchart: {
    type: DataTypes.JSON, 
    allowNull: true,
  },
}, {
  tableName: "workspace", timestamps: true,
});

module.exports = Workspace;