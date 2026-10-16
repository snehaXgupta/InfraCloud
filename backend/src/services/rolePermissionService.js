const { RolePermission, DEFAULT_ROLE_PERMISSIONS } = require('../models/RolePermission');

const initRolePermissions = async () => {
  const existing = await RolePermission.find().lean();
  const existingRoles = new Set(existing.map((r) => r.role));

  for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    if (!existingRoles.has(role)) {
      await RolePermission.create({ role, permissions });
    }
  }
};

const getAllRolePermissions = async () => {
  await initRolePermissions();
  const records = await RolePermission.find().sort({ createdAt: 1 }).lean();
  const result = {};
  for (const rec of records) {
    result[rec.role] = rec.permissions;
  }
  return result;
};

const updateRolePermissions = async (role, permissions) => {
  if (!DEFAULT_ROLE_PERMISSIONS[role]) {
    throw new Error(`Invalid role: ${role}`);
  }
  const updated = await RolePermission.findOneAndUpdate(
    { role },
    { $set: { permissions } },
    { new: true, upsert: true }
  );
  return updated;
};

const getUserEffectivePermissions = (user, roleMatrix) => {
  const baseRole = user?.role || 'Client Viewer';
  const roleDefaults = roleMatrix?.[baseRole] || DEFAULT_ROLE_PERMISSIONS[baseRole] || DEFAULT_ROLE_PERMISSIONS['Client Viewer'];

  const custom = user?.customPermissions ? (typeof user.customPermissions.toObject === 'function' ? user.customPermissions.toObject() : user.customPermissions) : {};

  const effective = { ...roleDefaults };
  for (const [mod, val] of Object.entries(custom)) {
    if (typeof val === 'boolean') {
      effective[mod] = val;
    }
  }
  return effective;
};

module.exports = {
  getAllRolePermissions,
  updateRolePermissions,
  getUserEffectivePermissions,
  DEFAULT_ROLE_PERMISSIONS,
};
