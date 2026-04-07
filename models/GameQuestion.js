// models/GameQuestion.js
module.exports = (sequelize, DataTypes) => {
  const GameQuestion = sequelize.define("GameQuestion", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    levelId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'levelId'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM(
        "mcq", "essay", "truefalse", "dragdrop", 
        "typing", "sort", "memory", "flashcard", "hangman"
      ),
      defaultValue: "mcq",
    },
    meta: {
      type: DataTypes.JSON,
      allowNull: true
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 10,
    },
    order: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  });

  GameQuestion.associate = (models) => {
    GameQuestion.belongsTo(models.GameLevel, {
      foreignKey: "levelId",
      as: 'Level'
    });
  };

  return GameQuestion;
};