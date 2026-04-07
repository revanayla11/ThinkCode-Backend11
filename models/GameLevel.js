// models/GameLevel.js
module.exports = (sequelize, DataTypes) => {
  const GameLevel = sequelize.define("GameLevel", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    materi_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'materi_id'
    },
    levelNumber: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM("quiz", "flashcard", "memory", "typing", "sort", "hangman"),
      defaultValue: "quiz",
    },
    totalQuestions: DataTypes.INTEGER,
    reward_xp: {
      type: DataTypes.INTEGER,
      defaultValue: 50
    },
    reward_badge_id: {
      type: DataTypes.INTEGER,
      field: 'reward_badge_id'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  });

  GameLevel.associate = (models) => {
    GameLevel.belongsTo(models.Materi, { 
      foreignKey: "materi_id",
      as: 'Materi'
    });
    GameLevel.belongsTo(models.Badge, { 
      foreignKey: "reward_badge_id",
      as: 'Badge'
    });
    GameLevel.hasMany(models.GameQuestion, { 
      foreignKey: "levelId",
      as: 'Questions'
    });
  };

  return GameLevel;
};