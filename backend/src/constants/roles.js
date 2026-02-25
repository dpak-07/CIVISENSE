const ROLES = Object.freeze({
  CITIZEN: 'citizen',
  ADMIN: 'admin',
  OFFICER: 'officer',
  SUPER_ADMIN: 'super_admin'
});

const ROLE_VALUES = Object.freeze(Object.values(ROLES));

module.exports = {
  ROLES,
  ROLE_VALUES
};
