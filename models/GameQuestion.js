module.exports = (sequelize, DataTypes) => {
  const GameQuestion = sequelize.define('GameQuestion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    levelId: DataTypes.INTEGER,
    content: DataTypes.TEXT,
    type: {
      type: DataTypes.ENUM('mcq', 'essay', 'truefalse', 'dragdrop', 'typing', 'sort'),
      defaultValue: 'mcq'
    },
    meta: DataTypes.JSON, // Store game-specific data
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 10
    }
  });

  return GameQuestion;
};