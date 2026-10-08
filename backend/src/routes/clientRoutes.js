const express = require('express');
const router = express.Router();
const {
  getClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
} = require('../controllers/clientController');
const { protect, authorize, ROLES: R } = require('../middleware/auth');
const { requireScope } = require('../middleware/scope');

router.use(protect);

router.route('/')
  .get(getClients)
  .post(authorize(R.ADMIN), createClient);

router.route('/:id')
  .get(requireScope('client'), getClientById)
  .put(authorize(R.ADMIN), updateClient)
  .delete(authorize(R.ADMIN), deleteClient);

module.exports = router;
