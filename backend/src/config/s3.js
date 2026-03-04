const { S3Client } = require('@aws-sdk/client-s3');
const env = require('./env');

const s3Config = {
  region: env.aws.region,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED'
};

if (env.aws.accessKeyId && env.aws.secretAccessKey) {
  s3Config.credentials = {
    accessKeyId: env.aws.accessKeyId,
    secretAccessKey: env.aws.secretAccessKey
  };
}

const s3Client = new S3Client(s3Config);

module.exports = s3Client;
