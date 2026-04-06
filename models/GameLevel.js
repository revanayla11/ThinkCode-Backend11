// models/GameLevel.js
module.exports = (sequelize, DataTypes) => {
  const GameLevel = sequelize.define('GameLevel', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    materi_id: DataTypes.INTEGER,
    levelNumber: DataTypes.INTEGER,
    title: DataTypes.STRING,
    type: {
      type: DataTypes.ENUM('quiz', 'flashcard', 'memory', 'typing', 'sort'),
      defaultValue: 'quiz'
    },
    totalQuestions: DataTypes.INTEGER,
    reward_xp: DataTypes.INTEGER,
    reward_badge_id: DataTypes.INTEGER,
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  });

  // ✅ TAMBAHKAN INI - Associate function
  GameLevel.associate = (models) => {
    GameLevel.belongsTo(models.Materi, { foreignKey: 'materi_id' });
    GameLevel.belongsTo(models.Badge, { foreignKey: 'reward_badge_id' });
    GameLevel.hasMany(models.GameQuestion, { foreignKey: 'levelId' });
  };

  return GameLevel;
};