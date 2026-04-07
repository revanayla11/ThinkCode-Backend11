'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Tambah hearts ke Users
    await queryInterface.addColumn('Users', 'hearts', {
      type: Sequelize.INTEGER,
      defaultValue: 5,
      allowNull: false
    });

    // Buat tabel streak (simple)
    await queryInterface.createTable('UserDailyStats', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      userId: { 
        type: Sequelize.INTEGER, 
        references: { model: 'Users', key: 'id' },
        onDelete: 'CASCADE'
      },
      date: { type: Sequelize.DATEONLY, primaryKey: true },
      streak: { type: Sequelize.INTEGER, defaultValue: 1 },
      createdAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      updatedAt: { type: Sequelize.DATE, defaultValue: Sequelize.NOW }
    });

    // Set default hearts untuk semua user
    await queryInterface.sequelize.query('UPDATE Users SET hearts = 5 WHERE hearts IS NULL');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Users', 'hearts');
    await queryInterface.dropTable('UserDailyStats');
  }
};