require("dotenv").config(); // ⬅️ WAJIB di atas

const { Sequelize } = require("sequelize");

console.log("MYSQL_URL:", process.env.MYSQL_URL ); // debug

const sequelize = new Sequelize(
  process.env.MYSQL_URL || "mysql://root:@127.0.0.1:3306/thinkcode", // fallback
  {
    dialect: "mysql",
    logging: false,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? {
        require: true,
        rejectUnauthorized: false,
      } : false,  // Local = false, Production = true
    },
  }
);

sequelize.authenticate()
  .then(() => console.log("✅ Database connected."))
  .catch(err => console.log("❌ DB ERROR:", err));

module.exports = sequelize;
