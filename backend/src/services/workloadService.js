const MunicipalOffice = require('../models/MunicipalOffice');

const incrementWorkload = async (municipalOfficeId, options = {}) => {
  await MunicipalOffice.findByIdAndUpdate(
    municipalOfficeId,
    {
      $inc: { workload: 1 }
    },
    {
      session: options.session || null
    }
  );
};

const decrementWorkload = async (municipalOfficeId, options = {}) => {
  await MunicipalOffice.findOneAndUpdate(
    { _id: municipalOfficeId },
    [
      {
        $set: {
          workload: {
            $max: [{ $subtract: ['$workload', 1] }, 0]
          }
        }
      }
    ],
    {
      session: options.session || null
    }
  );
};

module.exports = {
  incrementWorkload,
  decrementWorkload
};
