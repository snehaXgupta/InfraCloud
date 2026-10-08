const express = require('express');
const router = express.Router();
const {
  getEnvironments,
  getEnvironmentById,
  createEnvironment,
} = require('../controllers/environmentController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { requireScope } = require('../middleware/scope');

router.use(protect);

router.route('/')
  .get(getEnvironments)
  .post(
    authorize(R.ADMIN, R.DEVOPS, R.PROJECT_ADMIN),
    requireScope('project', (req) => req.body.projectId),
    createEnvironment
  );

router.route('/:id')
  .get(requireScope('environment'), getEnvironmentById);

module.exports = router;
