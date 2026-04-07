// models/Question.js
module.exports = (sequelize) => {
  const Question = sequelize.define('Question', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    level_id: DataTypes.INTEGER,
    type: DataTypes.ENUM('multiple_choice', 'true_false', 'drag_drop', 'tts'),
    question_text: DataTypes.TEXT,
    options: DataTypes.JSON,
    correct_answer: DataTypes.JSON,
    image_url: DataTypes.STRING,
    points: DataTypes.INTEGER
  });

  return Question;
};