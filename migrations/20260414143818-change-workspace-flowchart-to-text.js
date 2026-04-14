module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('workspaces', 'flowchart', {
      type: Sequelize.JSON,
      allowNull: true
    });
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('workspaces', 'flowchart', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  }
};