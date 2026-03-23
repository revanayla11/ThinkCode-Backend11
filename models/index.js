const User = require("./User");
const Materi = require("./Materi");
const MateriAnswer = require("./MateriAnswer");
const MateriSection = require("./MateriSection");
const UserMateriProgress = require("./UserMateriProgress");
const DiscussionRoom = require("./DiscussionRoom");
const DiscussionMessage = require("./DiscussionMessage");
const Upload = require("./Upload");
const LeaderboardIndividu = require("./LeaderboardIndividu");
const LeaderboardKelompok = require("./LeaderboardKelompok");
const Badge = require("./Badge");
const GameLevel = require("./GameLevel");
const GameQuestion = require("./GameQuestion");
const UserBadge = require("./UserBadge");
const Clue = require("./Clue");
const DiscussionClueLog = require("./DiscussionClueLog");
const RoomMember = require("./RoomMember");
const Workspace = require("./Workspace");
const WorkspaceAttempt = require("./WorkspaceAttempt");
const RoomTaskProgress = require("./RoomTaskProgress");
const Submission = require("./Submission");
const UserProgress = require("./UserProgress");
const TeacherFeedback = require("./TeacherFeedback");

MateriSection.belongsTo(Materi, { foreignKey: "materiId" });
DiscussionRoom.belongsTo(Materi, { foreignKey: "materiId" });

DiscussionMessage.belongsTo(DiscussionRoom, { foreignKey: "roomId" });
DiscussionMessage.belongsTo(User, { foreignKey: "userId" });

UserMateriProgress.belongsTo(User, { foreignKey: "userId" });
UserMateriProgress.belongsTo(Materi, { foreignKey: "materiId" });

Upload.belongsTo(User, { foreignKey: "userId" });
Upload.belongsTo(Materi, { foreignKey: "materiId" });
Upload.belongsTo(MateriSection, { foreignKey: "sectionId" });

Clue.belongsTo(Materi, { foreignKey:"materiId" });


DiscussionRoom.hasMany(DiscussionMessage, { foreignKey: "roomId" });
DiscussionMessage.belongsTo(DiscussionRoom, { foreignKey: "roomId" });

User.hasMany(DiscussionMessage, { foreignKey: "userId" });
DiscussionMessage.belongsTo(User, { foreignKey: "userId" });


GameLevel.belongsTo(Badge, {
  foreignKey: "reward_badge_id",
});

User.belongsToMany(Badge, {
  through: UserBadge,
  foreignKey: "user_id",
});

Badge.belongsToMany(User, {
  through: UserBadge,
  foreignKey: "badge_id",
});

DiscussionRoom.belongsToMany(User, {
  through: "discussion_room_users",
  foreignKey: "roomId",
});
User.belongsToMany(DiscussionRoom, {
  through: "discussion_room_users",
  foreignKey: "userId",
});

RoomMember.belongsTo(User, { foreignKey: "user_id", as: "user" });
User.hasMany(RoomMember, { foreignKey: "user_id", as: "roomMembers" });

RoomMember.belongsTo(DiscussionRoom, { foreignKey: "room_id", as: "room" });
DiscussionRoom.hasMany(RoomMember, { foreignKey: "room_id", as: "members" });

DiscussionRoom.belongsTo(Materi, { foreignKey: "materiId", as: "materi" });
Materi.hasMany(DiscussionRoom, { foreignKey: "materiId", as: "rooms" });

UserBadge.belongsTo(Badge, { foreignKey: "badge_id" });

Materi.hasMany(UserMateriProgress, { foreignKey: "materiId" });

DiscussionClueLog.belongsTo(Clue, { foreignKey: "clueId" });
DiscussionClueLog.belongsTo(User, { foreignKey: "takenBy" });

UserMateriProgress.belongsTo(DiscussionRoom, { foreignKey: "roomId", as: "room" });
DiscussionRoom.hasMany(UserMateriProgress, { foreignKey: "roomId", as: "progresses" });

DiscussionClueLog.belongsTo(DiscussionRoom, { foreignKey: "roomId", as: "room" });
DiscussionRoom.hasMany(DiscussionClueLog, { foreignKey: "roomId", as: "clueLogs" });

Workspace.belongsTo(DiscussionRoom, { foreignKey: "roomId", as: "room" });
DiscussionRoom.hasOne(Workspace, { foreignKey: "roomId", as: "workspace" });

WorkspaceAttempt.belongsTo(DiscussionRoom, { foreignKey: "roomId", as: "room" });
DiscussionRoom.hasMany(WorkspaceAttempt, { foreignKey: "roomId", as: "attempts" });

RoomTaskProgress.belongsTo(DiscussionRoom, { foreignKey: "roomId", as: "room" });
DiscussionRoom.hasMany(RoomTaskProgress, { foreignKey: "roomId", as: "tasks" });

Materi.hasOne(MateriAnswer, { foreignKey: "materiId", as: "answer" });
MateriAnswer.belongsTo(Materi, { foreignKey: "materiId", as: "materi" });

module.exports = {
  User,
  Materi,
  MateriAnswer,
  MateriSection,
  UserMateriProgress,
  DiscussionRoom,
  DiscussionMessage,
  Upload,
  LeaderboardIndividu,
  LeaderboardKelompok,
  Badge,
  UserBadge,
  Clue,
  GameLevel,
  GameQuestion,
  DiscussionClueLog,
  RoomMember,
  Workspace,
  WorkspaceAttempt,
  RoomTaskProgress,
  Submission,
  UserProgress,
  TeacherFeedback,
};


