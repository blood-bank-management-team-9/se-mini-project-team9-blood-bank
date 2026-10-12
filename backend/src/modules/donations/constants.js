// Defaults until the Config Service (C13) exists.
module.exports = {
  EDIT_WINDOW_HOURS: 24, // FR-DNR-06
  SHELF_LIFE_DAYS: Number(process.env.SHELF_LIFE_DAYS) || 35, // SRS default
  VOLUMES_ML: [350, 450],
  SCREENING_STATUSES: ['Passed', 'Failed'],
  TZ: 'Asia/Kolkata', // SAD 4.1
};
