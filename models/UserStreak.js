module.exports = (sequelize, DataTypes) => {
  const UserStreak = sequelize.define("UserStreak", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Users",
        key: "id"
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE"
    },
    streakCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    lastCompleted: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: "UserStreaks",
    timestamps: true
  });

  UserStreak.associate = (models) => {
    UserStreak.belongsTo(models.User, { foreignKey: "userId" });
  };

  return UserStreak;
};