const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const MateriSection = sequelize.define("MateriSection", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  materiId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM('video','text','mini','discussion','upload'), defaultValue: 'text' },
  content: { type: DataTypes.TEXT },
  order: { type: DataTypes.INTEGER, defaultValue: 1 }
}, {
  tableName: "materi_sections"
});
  MateriSection.associate = (models) => {
    MateriSection.belongsTo(models.Materi, {
      foreignKey: 'materiId'
    });
  };

module.exports = MateriSection;


