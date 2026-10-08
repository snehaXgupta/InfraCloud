const express = require('express');
const router = express.Router();
const {
  getProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
} = require('../controllers/projectController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { requireScope } = require('../middleware/scope');
const { getProjectCost } = require('../controllers/costController');

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(authorize(R.ADMIN, R.DEVOPS), requireScope('client', (req) => req.body.clientId), createProject);

router.route('/:id')
  .get(requireScope('project'), getProjectById)
  .put(
    authorize(R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN),
    requireScope('project'),
    requireScope('client', (req) => req.body.clientId),
    updateProject
  )
  .delete(authorize(R.ADMIN), deleteProject);

router.get('/:id/cost', requireScope('project'), getProjectCost);

module.exports = router;
