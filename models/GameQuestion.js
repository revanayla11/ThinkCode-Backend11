const { Model } = require("sequelize");

module.exports = (sequelize, DataTypes) => {
  class GameQuestion extends Model {
    static associate(models) {
      GameQuestion.belongsTo(models.GameLevel, {
        foreignKey: "levelId",
      });
    }
  }

  GameQuestion.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      levelId: DataTypes.INTEGER,
      content: DataTypes.TEXT,
      type: {
        type: DataTypes.ENUM(
          "mcq",
          "essay",
          "truefalse",
          "dragdrop",
          "typing",
          "sort"
        ),
        defaultValue: "mcq",
      },
      meta: DataTypes.JSON,
      points: {
        type: DataTypes.INTEGER,
        defaultValue: 10,
      },
    },
    {
      sequelize,
      modelName: "GameQuestion",
    }
  );

  return GameQuestion;
};