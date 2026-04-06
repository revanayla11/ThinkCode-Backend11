const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const UserMateriProgress = sequelize.define(
  "UserMateriProgress",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    materiId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    roomId: { 
      type: DataTypes.INTEGER,
      allowNull: true,  
      references: {
        model: 'discussion_rooms',  
        key: 'id',
      },
    },
    completedSections: {
      type: DataTypes.TEXT,
      defaultValue: "[]",
    },
    percent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    xp: {  
      type: DataTypes.INTEGER,
      defaultValue: 0, 
      allowNull: false,
    },
    questSteps: {
  type: DataTypes.TEXT,
  defaultValue: "[]",
},
  },
  {
    tableName: "user_material_progress",
    timestamps: true,
  }
);

module.exports = UserMateriProgress;