'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('workspaces', 'flowchart', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('workspaces', 'flowchart', {
      type: Sequelize.JSON,
      allowNull: true
    });
  }
};