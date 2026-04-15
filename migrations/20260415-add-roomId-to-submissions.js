'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('submissions', 'roomId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'discussion_rooms',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('submissions', 'roomId');
  }
};