require("dotenv").config();

const { Sequelize } = require("sequelize");

// Debug (biar yakin env kebaca)
console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    dialect: "mysql",
    logging: false,
  }
);

sequelize.authenticate()
  .then(() => console.log("✅ Database connected."))
  .catch(err => console.log("❌ DB ERROR:", err));

module.exports = sequelize;