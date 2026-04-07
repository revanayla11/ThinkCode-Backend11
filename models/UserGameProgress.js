// models/UserGameProgress.js
module.exports = (sequelize) => {
  const UserGameProgress = sequelize.define('UserGameProgress', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: DataTypes.INTEGER,
    game_id: DataTypes.INTEGER,
    level_id: DataTypes.INTEGER,
    score: DataTypes.INTEGER,
    xp_earned: DataTypes.INTEGER,
    badge_earned: DataTypes.STRING,
    completed_at: DataTypes.DATE
  });

  return UserGameProgress;
};