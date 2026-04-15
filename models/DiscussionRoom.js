const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Submission = require("./Submission");

const DiscussionRoom = sequelize.define(
  "DiscussionRoom",
  {
    id: { 
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    materiId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "materi_id"
    },

    title: {
      type: DataTypes.STRING,
      allowNull: false,
      field: "room_name"
    },

    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "max_members"
    },

    isClosed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      field: "is_closed" 
    }
  },
  {
    tableName: "discussion_rooms",
    timestamps: false
  }
);
Submission.belongsTo(DiscussionRoom, { foreignKey: "roomId" });
DiscussionRoom.hasMany(Submission, { foreignKey: "roomId" });

module.exports = DiscussionRoom;
