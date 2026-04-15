const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const User = require("./User");
const Materi = require("./Materi");
const Badge = require("./Badge"); 
const DiscussionRoom = require("./DiscussionRoom"); 

const Submission = sequelize.define("Submission", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  materiId: { type: DataTypes.INTEGER, allowNull: false },
  filePath: { type: DataTypes.STRING },
  note: { type: DataTypes.TEXT },
  status: { type: DataTypes.ENUM("pending", "graded", "rejected"), defaultValue: "pending" },
  score: { type: DataTypes.FLOAT, defaultValue: 0 },
  feedback: { type: DataTypes.TEXT },
  badge_id: { type: DataTypes.INTEGER }, 
  roomId: { 
  type: DataTypes.INTEGER,
  allowNull: true, 
  references: {
    model: 'discussion_rooms',
    key: 'id'
  }
},
}, { tableName: "submissions", timestamps: true });

Submission.belongsTo(User, { foreignKey: "userId" });
Submission.belongsTo(Materi, { foreignKey: "materiId" });
Submission.belongsTo(Badge, { foreignKey: "badge_id"}); 

module.exports = Submission;