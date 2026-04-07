// models/Level.js
module.exports = (sequelize) => {
  const Level = sequelize.define('Level', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    game_id: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Games',
        key: 'id'
      }
    },
    title: DataTypes.STRING,
    difficulty: DataTypes.ENUM('easy', 'medium', 'hard'),
    questions: DataTypes.JSON // Store questions per level
  });

  return Level;
};