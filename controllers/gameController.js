// controllers/gameController.js
const GameLevel = require("../models/GameLevel");
const GameQuestion = require("../models/GameQuestion");
const UserProgress = require("../models/UserProgress");
const User = require("../models/User");
const Badge = require("../models/Badge");
const UserBadge = require("../models/UserBadge");
const Materi = require("../models/Materi");
const { Op, Sequelize } = require('sequelize');

exports.getGameMap = async (req, res) => {
  try {
    const levels = await GameLevel.findAll({
      include: [{
        model: Materi, 
        attributes: ['id', 'title'],
        as: 'Materi'
      }],
      order: [['materi_id', 'ASC'], ['levelNumber', 'ASC']],
      where: { isActive: true }
    });

    const transformedLevels = levels.map(lvl => ({
      id: lvl.id,
      materiId: lvl.materi_id,
      materiName: lvl.Materi.title,
      levelNumber: lvl.levelNumber,
      title: lvl.title,
      type: lvl.type,
      reward_xp: lvl.reward_xp
    }));

    res.json({ status: true, levels: transformedLevels });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const progress = await UserProgress.findAll({
      where: { userId: req.user.id },
      attributes: ['levelId', 'completed', 'score']
    });
    res.json({ status: true, progress });
  } catch (err) {
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.getLevel = async (req, res) => {
  try {
    const level = await GameLevel.findByPk(req.params.id, {
      include: [{ 
        model: Materi, 
        attributes: ['title'] 
      }]
    });
    
    if (!level) {
      return res.status(404).json({ status: false, message: "Level tidak ditemukan" });
    }

    const questions = await GameQuestion.findAll({
      where: { levelId: level.id },
      order: [["order", "ASC"], ["id", "ASC"]]
    });

    res.json({ 
      status: true, 
      level: level.toJSON(),
      questions: questions.map(q => q.toJSON())
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: err.message });
  }
};

exports.submitLevel = async (req, res) => {
  try {
    const userId = req.user.id;
    const levelId = req.params.id;
    const answers = req.body.answers || [];

    const level = await GameLevel.findByPk(levelId, { 
      include: [{ model: Badge, as: 'Badge' }] 
    });
    if (!level) return res.status(404).json({ status: false, message: "Level tidak ditemukan" });

    let correct = 0, total = 0;

    for (const ans of answers) {
      const question = await GameQuestion.findByPk(ans.questionId);
      if (!question) continue;

      let meta = question.meta;
      total++;

      let isCorrect = false;

      switch (question.type) {
        case "mcq":
          isCorrect = Number(ans.answer) === Number(meta.answerIndex);
          break;
          
        case "truefalse":
        case "dragdrop":
        case "flashcard":
          isCorrect = String(ans.answer).trim().toLowerCase() === 
                     String(meta.isTrue || meta.correctZone || 'true').toLowerCase();
          break;
          
        case "essay":
        case "typing":
          isCorrect = String(ans.answer).trim().toLowerCase() === 
                     String(meta.answer).trim().toLowerCase();
          break;
          
        case "sort":
          isCorrect = JSON.stringify(ans.answer.sort()) === 
                     JSON.stringify((meta.correctOrder || meta.items || []).sort());
          break;
          
        case "memory":
          isCorrect = String(ans.answer) === String(meta.cardPair);
          break;
          
        case "hangman":
          isCorrect = String(ans.answer).trim().toLowerCase() === 
                     String(meta.word).trim().toLowerCase();
          break;
          
        default:
          isCorrect = false;
      }

      if (isCorrect) correct++;
    }

    const scorePercent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passThreshold = 70;
    const isPassed = scorePercent >= passThreshold;
    const gainedXp = isPassed ? level.reward_xp : Math.floor(level.reward_xp * 0.3);

    // Update/Insert progress
    await UserProgress.upsert({
      userId,
      levelId,
      completed: isPassed ? 1 : 0,
      score: scorePercent,
      attempts: Sequelize.literal('COALESCE(attempts, 0) + 1'),
      updatedAt: new Date()
    });

    // Add XP
    await User.increment('xp', { 
      by: gainedXp, 
      where: { id: userId } 
    });
    
    const updatedUser = await User.findByPk(userId, { 
      attributes: ['xp'] 
    });

    // Check and award badge
    let badge = null;
    if (isPassed && scorePercent === 100 && level.reward_badge_id) {
      const [userBadge, created] = await UserBadge.findOrCreate({
        where: { 
          user_id: userId, 
          badge_id: level.reward_badge_id 
        },
        defaults: { user_id: userId, badge_id: level.reward_badge_id }
      });
      
      if (created) {
        const badgeData = await Badge.findByPk(level.reward_badge_id);
        if (badgeData) {
          badge = {
            badge_name: badgeData.badge_name,
            image: `${process.env.BASE_URL || ''}/uploads/badges/${badgeData.image}`
          };
        }
      }
    }

    res.json({
      status: true,
      total,
      correct,
      scorePercent,
      gainedXp,
      totalXpUser: updatedUser.xp,
      badge,
      passed: isPassed
    });

  } catch (err) {
    console.error("SUBMIT ERROR:", err);
    res.status(500).json({ status: false, message: err.message });
  }
};