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
    allowNull: false,
    field: 'materi_id'  
  },
  pseudocode: {
    type: DataTypes.TEXT,
    allowNull: true    
  },
  flowchart: {
    type: DataTypes.JSON,
    allowNull: true    
  }
}, {
  tableName: "materi_answers",
  timestamps: true,
  underscored: true    
});

module.exports = MateriAnswer;