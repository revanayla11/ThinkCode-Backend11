const Sequelize = require("sequelize");
const sequelize = require("../config/db");

const db = {};

// ================= INIT MODELS ================= //
db.User = require("./User")(sequelize, Sequelize.DataTypes);
db.Materi = require("./Materi")(sequelize, Sequelize.DataTypes);
db.MateriAnswer = require("./MateriAnswer")(sequelize, Sequelize.DataTypes);
db.MateriSection = require("./MateriSection")(sequelize, Sequelize.DataTypes);
db.UserMateriProgress = require("./UserMateriProgress")(sequelize, Sequelize.DataTypes);
db.DiscussionRoom = require("./DiscussionRoom")(sequelize, Sequelize.DataTypes);
db.DiscussionMessage = require("./DiscussionMessage")(sequelize, Sequelize.DataTypes);
db.Upload = require("./Upload")(sequelize, Sequelize.DataTypes);
db.LeaderboardIndividu = require("./LeaderboardIndividu")(sequelize, Sequelize.DataTypes);
db.LeaderboardKelompok = require("./LeaderboardKelompok")(sequelize, Sequelize.DataTypes);
db.Badge = require("./Badge")(sequelize, Sequelize.DataTypes);
db.GameLevel = require("./GameLevel")(sequelize, Sequelize.DataTypes);
db.GameQuestion = require("./GameQuestion")(sequelize, Sequelize.DataTypes);
db.UserBadge = require("./UserBadge")(sequelize, Sequelize.DataTypes);
db.Clue = require("./Clue")(sequelize, Sequelize.DataTypes);
db.DiscussionClueLog = require("./DiscussionClueLog")(sequelize, Sequelize.DataTypes);
db.RoomMember = require("./RoomMember")(sequelize, Sequelize.DataTypes);
db.Workspace = require("./Workspace")(sequelize, Sequelize.DataTypes);
db.WorkspaceAttempt = require("./WorkspaceAttempt")(sequelize, Sequelize.DataTypes);
db.RoomTaskProgress = require("./RoomTaskProgress")(sequelize, Sequelize.DataTypes);
db.Submission = require("./Submission")(sequelize, Sequelize.DataTypes);
db.UserProgress = require("./UserProgress")(sequelize, Sequelize.DataTypes);
db.TeacherFeedback = require("./TeacherFeedback")(sequelize, Sequelize.DataTypes);

// ================= RUN ASSOCIATIONS ================= //
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

// ================= TAMBAHAN RELASI (JIKA TIDAK DI MODEL) ================= //

// Many-to-many User <-> Badge
db.User.belongsToMany(db.Badge, {
  through: db.UserBadge,
  foreignKey: "user_id",
});
db.Badge.belongsToMany(db.User, {
  through: db.UserBadge,
  foreignKey: "badge_id",
});

// Discussion Room relations
db.DiscussionRoom.belongsToMany(db.User, {
  through: "discussion_room_users",
  foreignKey: "roomId",
});
db.User.belongsToMany(db.DiscussionRoom, {
  through: "discussion_room_users",
  foreignKey: "userId",
});

// RoomMember
db.RoomMember.belongsTo(db.User, { foreignKey: "user_id", as: "user" });
db.User.hasMany(db.RoomMember, { foreignKey: "user_id", as: "roomMembers" });

db.RoomMember.belongsTo(db.DiscussionRoom, { foreignKey: "room_id", as: "room" });
db.DiscussionRoom.hasMany(db.RoomMember, { foreignKey: "room_id", as: "members" });

// Materi relations
db.Materi.hasMany(db.MateriSection, { foreignKey: "materiId", as: "sections" });
db.Materi.hasOne(db.MateriAnswer, { foreignKey: "materiId", as: "answer" });
db.MateriAnswer.belongsTo(db.Materi, { foreignKey: "materiId", as: "materi" });

// Discussion Clue Log
db.DiscussionClueLog.belongsTo(db.Clue, { foreignKey: "clueId" });
db.DiscussionClueLog.belongsTo(db.User, { foreignKey: "takenBy" });

db.DiscussionClueLog.belongsTo(db.DiscussionRoom, { foreignKey: "roomId", as: "room" });
db.DiscussionRoom.hasMany(db.DiscussionClueLog, { foreignKey: "roomId", as: "clueLogs" });

// Workspace
db.Workspace.belongsTo(db.DiscussionRoom, { foreignKey: "roomId", as: "room" });
db.DiscussionRoom.hasOne(db.Workspace, { foreignKey: "roomId", as: "workspace" });

// Workspace Attempt
db.WorkspaceAttempt.belongsTo(db.DiscussionRoom, { foreignKey: "roomId", as: "room" });
db.DiscussionRoom.hasMany(db.WorkspaceAttempt, { foreignKey: "roomId", as: "attempts" });

// Task Progress
db.RoomTaskProgress.belongsTo(db.DiscussionRoom, { foreignKey: "roomId", as: "room" });
db.DiscussionRoom.hasMany(db.RoomTaskProgress, { foreignKey: "roomId", as: "tasks" });

// UserMateriProgress ↔ Room
db.UserMateriProgress.belongsTo(db.DiscussionRoom, {
  foreignKey: "roomId",
  as: "room",
});
db.DiscussionRoom.hasMany(db.UserMateriProgress, {
  foreignKey: "roomId",
  as: "progresses",
});

// ================= EXPORT ================= //
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;