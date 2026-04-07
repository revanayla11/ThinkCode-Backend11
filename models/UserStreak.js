'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UserStreak extends Model {
    static associate(models) {
      UserStreak.belongsTo(models.User, { foreignKey: 'userId' });
    }
  }

  UserStreak.init({
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    date: {
      type: DataTypes.DATEONLY,
      primaryKey: true,
      allowNull: false
    },
    streak: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    }
  }, {
    sequelize,
    modelName: 'UserStreak',
    tableName: 'UserStreaks',
    timestamps: true
  });

  return UserStreak;
};