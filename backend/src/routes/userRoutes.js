const express = require('express');
const router = express.Router();
const { getUsers, updateUserRole, createUser } = require('../controllers/userController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');

router.use(protect);
router.use(authorize(R.ADMIN));

router.route('/')
  .get(getUsers)
  .post(createUser);

router.put('/:id/role', updateUserRole);

module.exports = router;
